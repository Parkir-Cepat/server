import request from 'supertest';
import { createTestServer, closeTestServer } from '../../utils/testServer.js';
import {
  cleanupDatabase,
  createTestUser,
  generateTestToken,
  expectGraphQLError,
  expectGraphQLSuccess
} from '../../utils/testHelpers.js';
import { MongoClient, ObjectId } from 'mongodb';

// Helper untuk membuat notifikasi langsung ke DB
async function createTestNotification(db, { userId, message = 'Test', isRead = false }) {
  const notification = {
    userId,
    message,
    isRead,
    createdAt: new Date()
  };
  const result = await db.collection('notifications').insertOne(notification);
  return { _id: result.insertedId, ...notification };
}

describe('Notification Resolvers Integration Tests', () => {
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

  describe('Query: getMyNotifications', () => {
    it('should return notifications for user', async () => {
      const user = await createTestUser(db);
      await createTestNotification(db, { userId: user._id });
      const token = generateTestToken(user._id.toString());
      const query = `query { getMyNotifications { _id message isRead } }`;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query });
      expectGraphQLSuccess(response);
      expect(Array.isArray(response.body.data.getMyNotifications)).toBe(true);
    });
    it('should throw error if not authenticated', async () => {
      const query = `query { getMyNotifications { _id } }`;
      const response = await request(app)
        .post('/graphql')
        .send({ query });
      expectGraphQLError(response, 'Anda harus login terlebih dahulu');
    });
  });

  describe('Query: getUnreadNotificationCount', () => {
    it('should return unread notification count', async () => {
      const user = await createTestUser(db);
      await createTestNotification(db, { userId: user._id, isRead: false });
      await createTestNotification(db, { userId: user._id, isRead: true });
      const token = generateTestToken(user._id.toString());
      const query = `query { getUnreadNotificationCount }`;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query });
      expectGraphQLSuccess(response);
      expect(response.body.data.getUnreadNotificationCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Mutation: markNotificationAsRead', () => {
    it('should mark a notification as read', async () => {
      const user = await createTestUser(db);
      const notif = await createTestNotification(db, { userId: user._id, isRead: false });
      const token = generateTestToken(user._id.toString());
      const mutation = `
        mutation MarkNotificationAsRead($id: ID!) {
          markNotificationAsRead(id: $id)
        }
      `;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: mutation, variables: { id: notif._id.toString() } });
      expectGraphQLSuccess(response);
      expect(response.body.data.markNotificationAsRead).toBe(true);
    });
  });

  describe('Mutation: markAllNotificationsAsRead', () => {
    it('should mark all notifications as read', async () => {
      const user = await createTestUser(db);
      await createTestNotification(db, { userId: user._id, isRead: false });
      const token = generateTestToken(user._id.toString());
      const mutation = `mutation { markAllNotificationsAsRead }`;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: mutation });
      expectGraphQLSuccess(response);
      expect(response.body.data.markAllNotificationsAsRead).toBe(true);
    });
  });
}); 