import request from 'supertest';
import { createTestServer, closeTestServer } from '../../utils/testServer.js';
import { 
  cleanupDatabase, 
  createTestUser, 
  generateTestToken,
  expectGraphQLError,
  expectGraphQLSuccess 
} from '../../utils/testHelpers.js';
import { MongoClient } from 'mongodb';

describe('User Resolvers Integration Tests', () => {
  let app;
  let db;
  let client;

  beforeAll(async () => {
    app = await createTestServer();
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db();
  });

  afterAll(async () => {
    await closeTestServer();
    await client.close();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  describe('Query: me', () => {
    it('should return current user when authenticated', async () => {
      const user = await createTestUser(db);
      const token = generateTestToken(user._id.toString());

      const query = `
        query {
          me {
            _id
            email
            name
            role
            saldo
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query });

      expectGraphQLSuccess(response);
      expect(response.body.data.me).toMatchObject({
        email: user.email,
        name: user.name,
        role: user.role
      });
    });

    it('should throw error when not authenticated', async () => {
      const query = `
        query {
          me {
            _id
            email
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ query });

      expectGraphQLError(response, 'Anda harus login terlebih dahulu');
    });
  });

  describe('Query: getUserById', () => {
    it('should return user by ID when authenticated', async () => {
      const user1 = await createTestUser(db);
      const user2 = await createTestUser(db, { email: 'user2@example.com' });
      const token = generateTestToken(user1._id.toString());

      const query = `
        query GetUserById($userId: ID!) {
          getUserById(userId: $userId) {
            _id
            email
            name
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ 
          query, 
          variables: { userId: user2._id.toString() } 
        });

      expectGraphQLSuccess(response);
      expect(response.body.data.getUserById.email).toBe(user2.email);
    });

    it('should throw error when not authenticated', async () => {
      const query = `
        query GetUserById($userId: ID!) {
          getUserById(userId: $userId) {
            _id
            email
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ 
          query, 
          variables: { userId: '507f1f77bcf86cd799439011' } 
        });

      expectGraphQLError(response, 'Anda harus login terlebih dahulu');
    });
  });

  describe('Mutation: register', () => {
    it('should register new user successfully', async () => {
      const mutation = `
        mutation Register($input: RegisterInput!) {
          register(input: $input) {
            token
            user {
              _id
              email
              name
              role
              saldo
            }
          }
        }
      `;

      const input = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
        role: 'customer'
      };

      const response = await request(app)
        .post('/graphql')
        .send({ query: mutation, variables: { input } });

      expectGraphQLSuccess(response);
      expect(response.body.data.register.token).toBeDefined();
      expect(response.body.data.register.user).toMatchObject({
        email: input.email,
        name: input.name,
        role: input.role,
        saldo: 0
      });

      // Verify user was created in database
      const createdUser = await db.collection('users').findOne({ email: input.email });
      expect(createdUser).toBeTruthy();
      expect(createdUser.email).toBe(input.email);
    });

    it('should throw error for duplicate email', async () => {
      await createTestUser(db, { email: 'existing@example.com' });

      const mutation = `
        mutation Register($input: RegisterInput!) {
          register(input: $input) {
            token
            user {
              email
            }
          }
        }
      `;

      const input = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Duplicate User'
      };

      const response = await request(app)
        .post('/graphql')
        .send({ query: mutation, variables: { input } });

      expectGraphQLError(response, 'Email sudah terdaftar');
    });

    it('should set default role to user if not provided', async () => {
      const mutation = `
        mutation Register($input: RegisterInput!) {
          register(input: $input) {
            user {
              role
            }
          }
        }
      `;

      const input = {
        email: 'defaultrole@example.com',
        password: 'password123',
        name: 'Default Role User'
      };

      const response = await request(app)
        .post('/graphql')
        .send({ query: mutation, variables: { input } });

      expectGraphQLSuccess(response);
      expect(response.body.data.register.user.role).toBe('user');
    });
  });

  describe('Mutation: login', () => {
    it('should login with correct credentials', async () => {
      const user = await createTestUser(db);

      const mutation = `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            token
            user {
              _id
              email
              name
            }
          }
        }
      `;

      const input = {
        email: user.email,
        password: 'password123' // This is the original password before hashing
      };

      const response = await request(app)
        .post('/graphql')
        .send({ query: mutation, variables: { input } });

      expectGraphQLSuccess(response);
      expect(response.body.data.login.token).toBeDefined();
      expect(response.body.data.login.user.email).toBe(user.email);
    });

    it('should throw error for non-existent email', async () => {
      const mutation = `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            token
          }
        }
      `;

      const input = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/graphql')
        .send({ query: mutation, variables: { input } });

      expectGraphQLError(response, 'Email atau password salah');
    });

    it('should throw error for incorrect password', async () => {
      const user = await createTestUser(db);

      const mutation = `
        mutation Login($input: LoginInput!) {
          login(input: $input) {
            token
          }
        }
      `;

      const input = {
        email: user.email,
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/graphql')
        .send({ query: mutation, variables: { input } });

      expectGraphQLError(response, 'Email atau password salah');
    });
  });

  describe('Mutation: updateProfile', () => {
    it('should update user profile when authenticated', async () => {
      const user = await createTestUser(db);
      const token = generateTestToken(user._id.toString());

      const mutation = `
        mutation UpdateProfile($name: String!) {
          updateProfile(name: $name) {
            _id
            name
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ 
          query: mutation, 
          variables: { name: 'Updated Name' } 
        });

      expectGraphQLSuccess(response);
      expect(response.body.data.updateProfile.name).toBe('Updated Name');

      // Verify update in database
      const updatedUser = await db.collection('users').findOne({ _id: user._id });
      expect(updatedUser.name).toBe('Updated Name');
    });

    it('should throw error when not authenticated', async () => {
      const mutation = `
        mutation UpdateProfile($name: String!) {
          updateProfile(name: $name) {
            name
          }
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ 
          query: mutation, 
          variables: { name: 'Updated Name' } 
        });

      expectGraphQLError(response, 'Anda harus login terlebih dahulu');
    });
  });

  describe('Mutation: changePassword', () => {
    it('should change password with correct old password', async () => {
      const user = await createTestUser(db);
      const token = generateTestToken(user._id.toString());

      const mutation = `
        mutation ChangePassword($oldPassword: String!, $newPassword: String!) {
          changePassword(oldPassword: $oldPassword, newPassword: $newPassword)
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ 
          query: mutation, 
          variables: { 
            oldPassword: 'password123',
            newPassword: 'newpassword123' 
          } 
        });

      expectGraphQLSuccess(response);
      expect(response.body.data.changePassword).toBe(true);
    });

    it('should throw error for incorrect old password', async () => {
      const user = await createTestUser(db);
      const token = generateTestToken(user._id.toString());

      const mutation = `
        mutation ChangePassword($oldPassword: String!, $newPassword: String!) {
          changePassword(oldPassword: $oldPassword, newPassword: $newPassword)
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ 
          query: mutation, 
          variables: { 
            oldPassword: 'wrongpassword',
            newPassword: 'newpassword123' 
          } 
        });

      expectGraphQLError(response, 'Password lama tidak sesuai');
    });

    it('should throw error when not authenticated', async () => {
      const mutation = `
        mutation ChangePassword($oldPassword: String!, $newPassword: String!) {
          changePassword(oldPassword: $oldPassword, newPassword: $newPassword)
        }
      `;

      const response = await request(app)
        .post('/graphql')
        .send({ 
          query: mutation, 
          variables: { 
            oldPassword: 'password123',
            newPassword: 'newpassword123' 
          } 
        });

      expectGraphQLError(response, 'Anda harus login terlebih dahulu');
    });
  });
}); 