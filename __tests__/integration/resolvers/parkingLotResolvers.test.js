import request from 'supertest';
import { createTestServer, closeTestServer } from '../../utils/testServer.js';
import {
  cleanupDatabase,
  createTestUser,
  createTestParkingLot,
  generateTestToken,
  expectGraphQLError,
  expectGraphQLSuccess
} from '../../utils/testHelpers.js';
import { MongoClient, ObjectId } from 'mongodb';

describe('ParkingLot Resolvers Integration Tests', () => {
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

  describe('Query: getParkingLot', () => {
    it('should return parking lot by ID', async () => {
      const user = await createTestUser(db, { role: 'landowner' });
      const parkingLot = await createTestParkingLot(db, { ownerId: user._id });
      const query = `
        query GetParkingLot($id: ID!) {
          getParkingLot(id: $id) {
            _id
            name
            ownerId
          }
        }
      `;
      const response = await request(app)
        .post('/graphql')
        .send({ query, variables: { id: parkingLot._id.toString() } });
      expectGraphQLSuccess(response);
      expect(response.body.data.getParkingLot._id).toBe(parkingLot._id.toString());
    });
    it('should throw error if parking lot not found', async () => {
      const query = `
        query GetParkingLot($id: ID!) {
          getParkingLot(id: $id) { _id }
        }
      `;
      const response = await request(app)
        .post('/graphql')
        .send({ query, variables: { id: new ObjectId().toString() } });
      expectGraphQLError(response, 'Tempat parkir tidak ditemukan');
    });
  });

  describe('Query: getNearbyParkingLots', () => {
    it('should return nearby parking lots', async () => {
      const user = await createTestUser(db, { role: 'landowner' });
      await createTestParkingLot(db, { ownerId: user._id, location: { coordinates: [106.8, -6.2] } });
      const query = `
        query GetNearbyParkingLots($longitude: Float!, $latitude: Float!) {
          getNearbyParkingLots(longitude: $longitude, latitude: $latitude) {
            _id
            name
          }
        }
      `;
      const response = await request(app)
        .post('/graphql')
        .send({ query, variables: { longitude: 106.8, latitude: -6.2 } });
      expectGraphQLSuccess(response);
      expect(Array.isArray(response.body.data.getNearbyParkingLots)).toBe(true);
    });
  });

  describe('Query: getMyParkingLots', () => {
    it('should return parking lots for landowner', async () => {
      const user = await createTestUser(db, { role: 'landowner' });
      await createTestParkingLot(db, { ownerId: user._id });
      const token = generateTestToken(user._id.toString(), 'landowner');
      const query = `query { getMyParkingLots { _id name } }`;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query });
      expectGraphQLSuccess(response);
      expect(Array.isArray(response.body.data.getMyParkingLots)).toBe(true);
    });
    it('should throw error if not authenticated', async () => {
      const query = `query { getMyParkingLots { _id } }`;
      const response = await request(app)
        .post('/graphql')
        .send({ query });
      expectGraphQLError(response, 'Anda harus login terlebih dahulu');
    });
    it('should throw error if not landowner', async () => {
      const user = await createTestUser(db, { role: 'customer' });
      const token = generateTestToken(user._id.toString(), 'customer');
      const query = `query { getMyParkingLots { _id } }`;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query });
      expectGraphQLError(response, 'Anda tidak memiliki akses');
    });
  });

  describe('Mutation: createParkingLot', () => {
    it('should create a parking lot for landowner', async () => {
      const user = await createTestUser(db, { role: 'landowner' });
      const token = generateTestToken(user._id.toString(), 'landowner');
      const createParkingLotMutation = `
        mutation CreateParkingLot($input: CreateParkingLotInput!) {
          createParkingLot(input: $input) { _id name ownerId }
        }
      `;
      const input = {
        name: 'Lot Baru',
        location: { coordinates: [106.8, -6.2] },
        capacity: { car: 10, motorcycle: 20 },
        address: 'Jl. Test',
        rates: { car: 5000, motorcycle: 2000 },
        operationalHours: { open: '08:00', close: '22:00' },
        facilities: ['CCTV'],
        images: ['https://dummy.com/img.jpg']
      };
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: createParkingLotMutation, variables: { input } });
      expectGraphQLSuccess(response);
      expect(response.body.data.createParkingLot.name).toBe('Lot Baru');
    });
    it('should throw error if not authenticated', async () => {
      const createParkingLotMutation = `
        mutation CreateParkingLot($input: CreateParkingLotInput!) {
          createParkingLot(input: $input) { _id }
        }
      `;
      const input = {
        name: 'Lot Baru',
        location: { coordinates: [106.8, -6.2] },
        capacity: { car: 10, motorcycle: 20 },
        address: 'Jl. Test',
        rates: { car: 5000, motorcycle: 2000 },
        operationalHours: { open: '08:00', close: '22:00' },
        facilities: ['CCTV'],
        images: ['https://dummy.com/img.jpg']
      };
      const response = await request(app)
        .post('/graphql')
        .send({ query: createParkingLotMutation, variables: { input } });
      expectGraphQLError(response, 'Anda harus login terlebih dahulu');
    });
    it('should throw error if not landowner', async () => {
      const user = await createTestUser(db, { role: 'customer' });
      const token = generateTestToken(user._id.toString(), 'customer');
      const createParkingLotMutation = `
        mutation CreateParkingLot($input: CreateParkingLotInput!) {
          createParkingLot(input: $input) { _id }
        }
      `;
      const input = {
        name: 'Lot Baru',
        location: { coordinates: [106.8, -6.2] },
        capacity: { car: 10, motorcycle: 20 },
        address: 'Jl. Test',
        rates: { car: 5000, motorcycle: 2000 },
        operationalHours: { open: '08:00', close: '22:00' },
        facilities: ['CCTV'],
        images: ['https://dummy.com/img.jpg']
      };
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: createParkingLotMutation, variables: { input } });
      expectGraphQLError(response, 'Anda tidak memiliki akses');
    });
  });

  describe('Mutation: updateParkingLot', () => {
    it('should update parking lot if owner', async () => {
      const user = await createTestUser(db, { role: 'landowner' });
      const parkingLot = await createTestParkingLot(db, { ownerId: user._id });
      const token = generateTestToken(user._id.toString(), 'landowner');
      const mutation = `
        mutation UpdateParkingLot($id: ID!, $input: UpdateParkingLotInput!) {
          updateParkingLot(id: $id, input: $input) {
            _id
            name
            rates { car motorcycle }
          }
        }
      `;
      const input = { name: 'Lot Updated', rates: { car: 6000, motorcycle: 2000 } };
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: mutation, variables: { id: parkingLot._id.toString(), input } });
      expectGraphQLSuccess(response);
      expect(response.body.data.updateParkingLot.name).toBe('Lot Updated');
      expect(response.body.data.updateParkingLot.rates.car).toBe(6000);
    });
    it('should throw error if not owner', async () => {
      const user = await createTestUser(db, { role: 'landowner' });
      const otherUser = await createTestUser(db, { role: 'landowner', email: 'other@ex.com' });
      const parkingLot = await createTestParkingLot(db, { ownerId: user._id });
      const token = generateTestToken(otherUser._id.toString(), 'landowner');
      const mutation = `
        mutation UpdateParkingLot($id: ID!, $input: UpdateParkingLotInput!) {
          updateParkingLot(id: $id, input: $input) { _id }
        }
      `;
      const input = { name: 'Lot Updated' };
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: mutation, variables: { id: parkingLot._id.toString(), input } });
      expectGraphQLError(response, 'Anda tidak memiliki akses');
    });
  });

  describe('Mutation: deleteParkingLot', () => {
    it('should delete parking lot if owner', async () => {
      const user = await createTestUser(db, { role: 'landowner' });
      const parkingLot = await createTestParkingLot(db, { ownerId: user._id });
      const token = generateTestToken(user._id.toString(), 'landowner');
      const mutation = `
        mutation DeleteParkingLot($id: ID!) {
          deleteParkingLot(id: $id)
        }
      `;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: mutation, variables: { id: parkingLot._id.toString() } });
      expectGraphQLSuccess(response);
      expect(response.body.data.deleteParkingLot).toBe(true);
    });
    it('should throw error if not owner', async () => {
      const user = await createTestUser(db, { role: 'landowner' });
      const otherUser = await createTestUser(db, { role: 'landowner', email: 'other@ex.com' });
      const parkingLot = await createTestParkingLot(db, { ownerId: user._id });
      const token = generateTestToken(otherUser._id.toString(), 'landowner');
      const mutation = `
        mutation DeleteParkingLot($id: ID!) {
          deleteParkingLot(id: $id)
        }
      `;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: mutation, variables: { id: parkingLot._id.toString() } });
      expectGraphQLError(response, 'Anda tidak memiliki akses');
    });
  });

  describe('Mutation: addParkingLotImage', () => {
    it('should add image to parking lot if owner', async () => {
      const user = await createTestUser(db, { role: 'landowner' });
      const parkingLot = await createTestParkingLot(db, { ownerId: user._id, images: [] });
      const token = generateTestToken(user._id.toString(), 'landowner');
      const mutation = `
        mutation AddParkingLotImage($id: ID!, $imageUrl: String!) {
          addParkingLotImage(id: $id, imageUrl: $imageUrl) {
            _id
            images
          }
        }
      `;
      const imageUrl = 'http://img.com/1.jpg';
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: mutation, variables: { id: parkingLot._id.toString(), imageUrl } });
      expectGraphQLSuccess(response);
      expect(response.body.data.addParkingLotImage.images).toContain(imageUrl);
    });
  });

  describe('Mutation: removeParkingLotImage', () => {
    it('should remove image from parking lot if owner', async () => {
      const user = await createTestUser(db, { role: 'landowner' });
      const parkingLot = await createTestParkingLot(db, { ownerId: user._id, images: ['http://img.com/1.jpg'] });
      const token = generateTestToken(user._id.toString(), 'landowner');
      const mutation = `
        mutation RemoveParkingLotImage($id: ID!, $imageUrl: String!) {
          removeParkingLotImage(id: $id, imageUrl: $imageUrl) {
            _id
            images
          }
        }
      `;
      const imageUrl = 'http://img.com/1.jpg';
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: mutation, variables: { id: parkingLot._id.toString(), imageUrl } });
      expectGraphQLSuccess(response);
      expect(response.body.data.removeParkingLotImage.images).not.toContain(imageUrl);
    });
  });

  describe('Mutation: updateParkingLotRating', () => {
    it('should update rating if valid', async () => {
      const user = await createTestUser(db, { role: 'landowner' });
      const parkingLot = await createTestParkingLot(db, { ownerId: user._id });
      const token = generateTestToken(user._id.toString(), 'landowner');
      const mutation = `
        mutation UpdateParkingLotRating($id: ID!, $rating: Float!) {
          updateParkingLotRating(id: $id, rating: $rating) {
            _id
            rating
          }
        }
      `;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: mutation, variables: { id: parkingLot._id.toString(), rating: 4 } });
      expectGraphQLSuccess(response);
      expect(response.body.data.updateParkingLotRating.rating).toBeGreaterThanOrEqual(1);
    });
    it('should throw error if rating invalid', async () => {
      const user = await createTestUser(db, { role: 'landowner' });
      const parkingLot = await createTestParkingLot(db, { ownerId: user._id });
      const token = generateTestToken(user._id.toString(), 'landowner');
      const mutation = `
        mutation UpdateParkingLotRating($id: ID!, $rating: Float!) {
          updateParkingLotRating(id: $id, rating: $rating) { _id }
        }
      `;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: mutation, variables: { id: parkingLot._id.toString(), rating: 10 } });
      expectGraphQLError(response, 'Rating harus antara 1-5');
    });
  });

  describe('Query: searchParkingLots', () => {
    it('should return parking lots matching query', async () => {
      const user = await createTestUser(db, { role: 'landowner' });
      await createTestParkingLot(db, { ownerId: user._id, name: 'CariParkir', address: 'Jl. Cari' });
      const query = `
        query SearchParkingLots($query: String!) {
          searchParkingLots(query: $query) { _id name address }
        }
      `;
      const response = await request(app)
        .post('/graphql')
        .send({ query, variables: { query: 'Cari' } });
      expectGraphQLSuccess(response);
      expect(response.body.data.searchParkingLots.length).toBeGreaterThan(0);
    });
  });
}); 