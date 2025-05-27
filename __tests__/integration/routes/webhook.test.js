import request from 'supertest';
import { createTestServer, closeTestServer } from '../../utils/testServer.js';
import { cleanupDatabase } from '../../utils/testHelpers.js';

describe('Webhook and Express Routes Integration Tests', () => {
  let app;

  beforeAll(async () => {
    app = await createTestServer();
  });

  afterAll(async () => {
    await closeTestServer();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  describe('POST /midtrans-webhook', () => {
    it('should handle webhook notification successfully', async () => {
      const webhookPayload = {
        order_id: 'ORD-123456789',
        transaction_status: 'settlement',
        payment_type: 'credit_card',
        transaction_id: 'TXN-123456789',
        gross_amount: '50000.00'
      };

      const response = await request(app)
        .post('/midtrans-webhook')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'success'
      });
    });

    it('should handle webhook with booking order ID', async () => {
      const webhookPayload = {
        order_id: 'ORD-booking-123',
        transaction_status: 'settlement',
        payment_type: 'bank_transfer',
        transaction_id: 'TXN-booking-123'
      };

      const response = await request(app)
        .post('/midtrans-webhook')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });

    it('should handle webhook with top-up order ID', async () => {
      const webhookPayload = {
        order_id: 'TOP-topup-123',
        transaction_status: 'settlement',
        payment_type: 'gopay',
        transaction_id: 'TXN-topup-123'
      };

      const response = await request(app)
        .post('/midtrans-webhook')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });

    it('should handle webhook with pending status', async () => {
      const webhookPayload = {
        order_id: 'ORD-pending-123',
        transaction_status: 'pending',
        payment_type: 'bank_transfer',
        transaction_id: 'TXN-pending-123'
      };

      const response = await request(app)
        .post('/midtrans-webhook')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });

    it('should handle webhook with failed status', async () => {
      const webhookPayload = {
        order_id: 'ORD-failed-123',
        transaction_status: 'failure',
        payment_type: 'credit_card',
        transaction_id: 'TXN-failed-123'
      };

      const response = await request(app)
        .post('/midtrans-webhook')
        .send(webhookPayload);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');
    });

    it('should handle invalid webhook payload gracefully', async () => {
      const invalidPayload = {
        invalid_field: 'invalid_value'
      };

      const response = await request(app)
        .post('/midtrans-webhook')
        .send(invalidPayload);

      // Should still return 200 but might have different handling
      expect(response.status).toBe(200);
    });

    it('should handle empty webhook payload', async () => {
      const response = await request(app)
        .post('/midtrans-webhook')
        .send({});

      expect(response.status).toBe(200);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/midtrans-webhook')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });
  });

  describe('GET /health', () => {
    it('should return health check status', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        timestamp: expect.any(String)
      });
    });

    it('should return valid timestamp format', async () => {
      const response = await request(app)
        .get('/health');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe('CORS and Middleware', () => {
    it('should handle CORS preflight request', async () => {
      const response = await request(app)
        .options('/graphql')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should accept requests from allowed origin', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Origin', 'http://localhost:3000')
        .send({ query: '{ __typename }' });

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should handle JSON parsing middleware', async () => {
      const response = await request(app)
        .post('/midtrans-webhook')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ test: 'data' }));

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/non-existent-route');

      expect(response.status).toBe(404);
    });

    it('should handle invalid HTTP methods on webhook', async () => {
      const response = await request(app)
        .get('/midtrans-webhook');

      expect(response.status).toBe(404);
    });

    it('should handle large payload gracefully', async () => {
      const largePayload = {
        order_id: 'ORD-large-payload',
        data: 'x'.repeat(10000) // 10KB of data
      };

      const response = await request(app)
        .post('/midtrans-webhook')
        .send(largePayload);

      expect(response.status).toBe(200);
    });
  });

  describe('Security Headers', () => {
    it('should not expose sensitive server information', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.headers['x-powered-by']).toBeUndefined();
      // Server header might be set by the test environment, so we just check x-powered-by
    });

    it('should handle requests without authorization header', async () => {
      const response = await request(app)
        .post('/graphql')
        .send({ query: '{ __typename }' });

      expect(response.status).toBe(200);
    });

    it('should handle malformed authorization header', async () => {
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', 'InvalidFormat')
        .send({ query: '{ __typename }' });

      expect(response.status).toBe(200);
    });
  });
}); 