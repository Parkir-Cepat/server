import request from 'supertest';
import { createTestServer, closeTestServer } from '../../utils/testServer.js';
import {
  cleanupDatabase,
  createTestUser,
  createTestBooking,
  generateTestToken,
  expectGraphQLError,
  expectGraphQLSuccess
} from '../../utils/testHelpers.js';
import { MongoClient, ObjectId } from 'mongodb';

// Helper untuk membuat payment langsung ke DB
async function createTestPayment(db, { bookingId, userId, amount = 10000, status = 'pending', paymentMethod = 'saldo' }) {
  const payment = {
    bookingId,
    transactionId: `SAL-${Date.now()}`,
    paymentMethod,
    amount,
    status,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const result = await db.collection('payments').insertOne(payment);
  return { _id: result.insertedId, ...payment };
}

describe('Payment Resolvers Integration Tests', () => {
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

  describe('Query: getMyPaymentHistory', () => {
    it('should return payment history for user', async () => {
      const user = await createTestUser(db);
      const booking = await createTestBooking(db, { userId: user._id });
      await createTestPayment(db, { bookingId: booking._id, userId: user._id });
      const token = generateTestToken(user._id.toString());
      const query = `query { getMyPaymentHistory { _id amount status } }`;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query });
      expectGraphQLSuccess(response);
      expect(Array.isArray(response.body.data.getMyPaymentHistory)).toBe(true);
    });
  });

  describe('Query: getPayment', () => {
    it('should return payment by ID if user is owner', async () => {
      const user = await createTestUser(db);
      const booking = await createTestBooking(db, { userId: user._id });
      const payment = await createTestPayment(db, { bookingId: booking._id, userId: user._id });
      const token = generateTestToken(user._id.toString());
      const query = `
        query GetPayment($id: ID!) {
          getPayment(id: $id) { _id amount status }
        }
      `;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query, variables: { id: payment._id.toString() } });
      expectGraphQLSuccess(response);
      expect(response.body.data.getPayment._id).toBe(payment._id.toString());
    });
  });

  describe('Query: getBookingPayment', () => {
    it('should return payment by bookingId if user is owner', async () => {
      const user = await createTestUser(db);
      const booking = await createTestBooking(db, { userId: user._id });
      const payment = await createTestPayment(db, { bookingId: booking._id, userId: user._id });
      const token = generateTestToken(user._id.toString());
      const query = `
        query GetBookingPayment($bookingId: ID!) {
          getBookingPayment(bookingId: $bookingId) { _id amount status }
        }
      `;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query, variables: { bookingId: booking._id.toString() } });
      expectGraphQLSuccess(response);
      expect(response.body.data.getBookingPayment._id).toBe(payment._id.toString());
    });
  });

  describe('Mutation: createPayment', () => {
    it('should throw error if booking not found', async () => {
      const user = await createTestUser(db);
      const token = generateTestToken(user._id.toString());
      const createPaymentMutation = `
        mutation CreatePayment($input: CreatePaymentInput!) {
          createPayment(input: $input) { _id status amount }
        }
      `;
      const input = { bookingId: new ObjectId().toString(), paymentMethod: 'saldo' };
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: createPaymentMutation, variables: { input } });
      expectGraphQLError(response, 'Booking tidak ditemukan');
    });
  });

  describe('Query: getMySaldoTransactions', () => {
    it('should return saldo transactions for user', async () => {
      const user = await createTestUser(db);
      const token = generateTestToken(user._id.toString());
      const query = `query { getMySaldoTransactions { _id amount status } }`;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query });
      expectGraphQLSuccess(response);
      expect(Array.isArray(response.body.data.getMySaldoTransactions)).toBe(true);
    });
  });
}); 