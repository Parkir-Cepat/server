import { Notification } from '../../../models/Notification.js';
import { getDB } from '../../../config/db.js';
import { ObjectId } from 'mongodb';

jest.mock('../../../config/db.js');

describe('Notification Model', () => {
  let mockDb;
  let mockCollection;

  beforeEach(() => {
    mockCollection = {
      insertOne: jest.fn(),
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
      countDocuments: jest.fn(),
      createIndex: jest.fn()
    };
    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection)
    };
    getDB.mockReturnValue(mockDb);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a notification', async () => {
      const notificationData = { userId: '507f1f77bcf86cd799439011', message: 'Test' };
      const insertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValue({ insertedId });
      const result = await Notification.create(notificationData);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        userId: new ObjectId(notificationData.userId),
        isRead: false,
        message: 'Test',
        createdAt: expect.any(Date)
      }));
      expect(result._id).toBe(insertedId);
    });
  });

  describe('findByUserId', () => {
    it('should find notifications by userId', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockNotifications = [{ _id: new ObjectId(), userId: new ObjectId(userId) }];
      mockCollection.toArray.mockResolvedValue(mockNotifications);
      const result = await Notification.findByUserId(userId);
      expect(mockCollection.find).toHaveBeenCalledWith({ userId: new ObjectId(userId) });
      expect(mockCollection.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockCollection.limit).toHaveBeenCalledWith(20);
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('markAsRead', () => {
    it('should mark a notification as read', async () => {
      const id = '507f1f77bcf86cd799439011';
      const userId = '507f1f77bcf86cd799439012';
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
      const result = await Notification.markAsRead(id, userId);
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: new ObjectId(id), userId: new ObjectId(userId) },
        { $set: { isRead: true } }
      );
      expect(result).toEqual({ modifiedCount: 1 });
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read for a user', async () => {
      const userId = '507f1f77bcf86cd799439011';
      mockCollection.updateMany.mockResolvedValue({ modifiedCount: 2 });
      const result = await Notification.markAllAsRead(userId);
      expect(mockCollection.updateMany).toHaveBeenCalledWith(
        { userId: new ObjectId(userId) },
        { $set: { isRead: true } }
      );
      expect(result).toEqual({ modifiedCount: 2 });
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      const userId = '507f1f77bcf86cd799439011';
      mockCollection.countDocuments.mockResolvedValue(5);
      const result = await Notification.getUnreadCount(userId);
      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        userId: new ObjectId(userId),
        isRead: false
      });
      expect(result).toBe(5);
    });
  });

  describe('setupIndexes', () => {
    it('should create indexes', async () => {
      mockCollection.createIndex.mockResolvedValue({});
      await Notification.setupIndexes();
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ userId: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ isRead: 1 });
    });
  });

  describe('createBookingNotification', () => {
    it('should create booking notification with correct message', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const booking = { _id: 'bookingid123' };
      mockCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
      const result = await Notification.createBookingNotification(userId, 'booking_created', booking);
      expect(mockCollection.insertOne).toHaveBeenCalled();
      const callArg = mockCollection.insertOne.mock.calls[0][0];
      expect(callArg.message).toContain('booking ID: bookingid123');
      expect(callArg.data).toMatchObject({ action: 'booking_created', bookingId: 'bookingid123' });
      expect(result).toHaveProperty('_id');
    });
  });

  describe('createPaymentNotification', () => {
    it('should create payment notification with correct message', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const payment = { _id: 'paymentid123', amount: 10000 };
      mockCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
      const result = await Notification.createPaymentNotification(userId, 'payment_success', payment);
      expect(mockCollection.insertOne).toHaveBeenCalled();
      const callArg = mockCollection.insertOne.mock.calls[0][0];
      expect(callArg.message).toContain('Rp 10.000');
      expect(callArg.data).toMatchObject({ action: 'payment_success', amount: 10000, paymentId: 'paymentid123' });
      expect(result).toHaveProperty('_id');
    });
  });

  describe('createChatNotification', () => {
    it('should create chat notification with correct message', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const chatMessage = { _id: 'chatid123', message: 'Pesan baru dari user', bookingId: 'bookingid', senderId: 'senderid' };
      mockCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
      const result = await Notification.createChatNotification(userId, chatMessage);
      expect(mockCollection.insertOne).toHaveBeenCalled();
      const callArg = mockCollection.insertOne.mock.calls[0][0];
      expect(callArg.message).toContain('Pesan baru dari user');
      expect(callArg.data).toMatchObject({ chatId: 'chatid123', senderId: 'senderid', bookingId: 'bookingid' });
      expect(result).toHaveProperty('_id');
    });
  });
}); 