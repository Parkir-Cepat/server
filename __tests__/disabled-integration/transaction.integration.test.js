// Integration tests for Transaction flows: top-up, payment, status, and error handling
import request from 'supertest';
import { createTestUser, cleanupDatabase } from '../utils/testHelpers';
const { app } = require('../../index.js');

let testUser;

beforeAll(async () => {
  testUser = await createTestUser();
});

afterAll(async () => {
  await cleanupDatabase();
});

describe('Transaction Integration', () => {
  it('should return empty transaction history for new user', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({
        query: `query { getMyTransactionHistory { _id amount type status } }`
      })
      .set('Authorization', `Bearer ${testUser.token}`);
    expect(res.body.data.getMyTransactionHistory).toEqual([]);
  });

  it('should fail to get payment history if not authenticated', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({
        query: `query { getMyPaymentHistory { _id amount type status } }`
      });
    expect(res.body.errors[0].message).toMatch(/login terlebih dahulu/);
  });

  // Add more integration tests for top-up, payment, and webhook simulation as needed
});
