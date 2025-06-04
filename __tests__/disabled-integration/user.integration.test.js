// Integration tests for User flows: registration, login, dashboard stats, and error handling
import request from 'supertest';
const { app } = require('../../index.js');

const testEmail = `integration${Date.now()}@test.com`;
const testPassword = 'TestPassword123!';

let token;

describe('User Integration', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({
        query: `mutation Register($input: RegisterInput!) { register(input: $input) { _id email name role } }`,
        variables: {
          input: {
            email: testEmail,
            password: testPassword,
            name: 'Integration User',
            role: 'user'
          }
        }
      });
    expect(res.body.data.register.email).toBe(testEmail);
  });

  it('should login with registered user', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({
        query: `mutation Login($input: LoginInput!) { login(input: $input) { token user { _id email } } }`,
        variables: {
          input: {
            email: testEmail,
            password: testPassword
          }
        }
      });
    expect(res.body.data.login.token).toBeDefined();
    token = res.body.data.login.token;
  });

  it('should get user dashboard stats', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({ query: `query { getDashboardStats { activeBookings totalBookings totalSpent } }` })
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data.getDashboardStats).toHaveProperty('activeBookings');
  });

  it('should fail to get dashboard stats if not authenticated', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({ query: `query { getDashboardStats { activeBookings } }` });
    expect(res.body.errors[0].message).toMatch(/login terlebih dahulu/);
  });
});
