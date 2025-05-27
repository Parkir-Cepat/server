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

// Helper untuk membuat chat langsung ke DB
async function createTestChat(db, { senderId, receiverId, message = 'Hello', bookingId = null, read = false }) {
  const chat = {
    senderId,
    receiverId,
    message,
    bookingId,
    read,
    createdAt: new Date()
  };
  const result = await db.collection('chats').insertOne(chat);
  return { _id: result.insertedId, ...chat };
}

describe('Chat Resolvers Integration Tests', () => {
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

  describe('Query: getChatHistory', () => {
    it('should return chat history between users', async () => {
      const user1 = await createTestUser(db);
      const user2 = await createTestUser(db, { email: 'user2@example.com' });
      await createTestChat(db, { senderId: user1._id, receiverId: user2._id });
      const token = generateTestToken(user1._id.toString());
      const query = `query GetChatHistory($userId: ID!) { getChatHistory(userId: $userId) { _id message } }`;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query, variables: { userId: user2._id.toString() } });
      expectGraphQLSuccess(response);
      expect(Array.isArray(response.body.data.getChatHistory)).toBe(true);
    });
  });

  describe('Query: getChatParticipants', () => {
    it('should return chat participants for user', async () => {
      const user = await createTestUser(db);
      const token = generateTestToken(user._id.toString());
      const query = `query { getChatParticipants { _id name lastMessage lastMessageTime unreadCount } }`;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query });
      expectGraphQLSuccess(response);
      expect(Array.isArray(response.body.data.getChatParticipants)).toBe(true);
    });
  });

  describe('Query: getUnreadMessages', () => {
    it('should return unread messages for user', async () => {
      const user = await createTestUser(db);
      await createTestChat(db, { senderId: new ObjectId(), receiverId: user._id, read: false });
      const token = generateTestToken(user._id.toString());
      const query = `query { getUnreadMessages { _id message read } }`;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query });
      expectGraphQLSuccess(response);
      expect(Array.isArray(response.body.data.getUnreadMessages)).toBe(true);
    });
  });

  describe('Mutation: sendMessage', () => {
    it('should send a message to another user', async () => {
      const user1 = await createTestUser(db);
      const user2 = await createTestUser(db, { email: 'user2@example.com' });
      const token = generateTestToken(user1._id.toString());
      const mutation = `
        mutation SendMessage($input: SendMessageInput!) {
          sendMessage(input: $input) { _id message senderId receiverId }
        }
      `;
      const input = { receiverId: user2._id.toString(), message: 'Hello' };
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: mutation, variables: { input } });
      expectGraphQLSuccess(response);
      expect(response.body.data.sendMessage.message).toBe('Hello');
    });
  });

  describe('Mutation: markMessageAsRead', () => {
    it('should mark a message as read if receiver', async () => {
      const sender = await createTestUser(db);
      const receiver = await createTestUser(db, { email: 'receiver@example.com' });
      const chat = await createTestChat(db, { senderId: sender._id, receiverId: receiver._id, read: false });
      const token = generateTestToken(receiver._id.toString());
      const mutation = `
        mutation MarkMessageAsRead($messageId: ID!) {
          markMessageAsRead(messageId: $messageId) { _id read }
        }
      `;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: mutation, variables: { messageId: chat._id.toString() } });
      expectGraphQLSuccess(response);
      expect(response.body.data.markMessageAsRead.read).toBe(true);
    });
  });

  describe('Mutation: markAllMessagesAsRead', () => {
    it('should mark all messages as read from sender', async () => {
      const sender = await createTestUser(db);
      const receiver = await createTestUser(db, { email: 'receiver@example.com' });
      await createTestChat(db, { senderId: sender._id, receiverId: receiver._id, read: false });
      const token = generateTestToken(receiver._id.toString());
      const mutation = `
        mutation MarkAllMessagesAsRead($senderId: ID!) {
          markAllMessagesAsRead(senderId: $senderId)
        }
      `;
      const response = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({ query: mutation, variables: { senderId: sender._id.toString() } });
      expectGraphQLSuccess(response);
      expect(response.body.data.markAllMessagesAsRead).toBe(true);
    });
  });
}); 