import { Chat } from '../../../models/Chat.js';
import { getDB } from '../../../config/db.js';
import { ObjectId } from 'mongodb';

jest.mock('../../../config/db.js');

describe('Chat Model', () => {
  let mockDb;
  let mockCollection;
  let mockUserCollection;

  beforeEach(() => {
    mockCollection = {
      findOne: jest.fn(),
      insertOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
      aggregate: jest.fn().mockReturnThis(),
      updateMany: jest.fn(),
      createIndex: jest.fn()
    };
    mockUserCollection = {
      findOne: jest.fn()
    };
    mockDb = {
      collection: jest.fn((name) => {
        if (name === 'chats') return mockCollection;
        if (name === 'users') return mockUserCollection;
        return mockCollection;
      })
    };
    getDB.mockReturnValue(mockDb);
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should find chat by ID', async () => {
      const chatId = '507f1f77bcf86cd799439011';
      const mockChat = { _id: new ObjectId(chatId), message: 'Hello' };
      mockCollection.findOne.mockResolvedValue(mockChat);
      const result = await Chat.findById(chatId);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: new ObjectId(chatId) });
      expect(result).toEqual(mockChat);
    });
  });

  describe('sendMessage', () => {
    it('should send a message if both users exist', async () => {
      const senderId = '507f1f77bcf86cd799439011';
      const receiverId = '507f1f77bcf86cd799439012';
      const message = 'Hello';
      mockUserCollection.findOne.mockResolvedValueOnce({ _id: new ObjectId(senderId) });
      mockUserCollection.findOne.mockResolvedValueOnce({ _id: new ObjectId(receiverId) });
      const insertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValue({ insertedId });
      const result = await Chat.sendMessage(senderId, receiverId, message);
      expect(mockUserCollection.findOne).toHaveBeenCalledTimes(2);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        senderId: new ObjectId(senderId),
        receiverId: new ObjectId(receiverId),
        message,
        read: false,
        createdAt: expect.any(Date)
      }));
      expect(result._id).toBe(insertedId);
    });
    it('should throw error if sender or receiver not found', async () => {
      const validId = '507f1f77bcf86cd799439011';
      mockUserCollection.findOne.mockResolvedValueOnce(null);
      mockUserCollection.findOne.mockResolvedValueOnce({});
      await expect(Chat.sendMessage(validId, validId, 'msg')).rejects.toThrow('Pengirim atau penerima tidak ditemukan');
    });
  });

  describe('markAsRead', () => {
    it('should mark a message as read', async () => {
      const messageId = '507f1f77bcf86cd799439011';
      const updatedChat = { _id: new ObjectId(messageId), read: true };
      mockCollection.findOneAndUpdate.mockResolvedValue(updatedChat);
      const result = await Chat.markAsRead(messageId);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new ObjectId(messageId) },
        { $set: { read: true } },
        { returnDocument: 'after' }
      );
      expect(result).toEqual(updatedChat);
    });
  });

  describe('getChatHistory', () => {
    it('should get chat history between two users', async () => {
      const userId1 = '507f1f77bcf86cd799439011';
      const userId2 = '507f1f77bcf86cd799439012';
      const mockChats = [{ _id: new ObjectId(), message: 'Hi' }];
      mockCollection.toArray.mockResolvedValue(mockChats);
      const result = await Chat.getChatHistory(userId1, userId2);
      expect(mockCollection.find).toHaveBeenCalledWith({
        $or: [
          { senderId: new ObjectId(userId1), receiverId: new ObjectId(userId2) },
          { senderId: new ObjectId(userId2), receiverId: new ObjectId(userId1) }
        ]
      });
      expect(mockCollection.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockCollection.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual(mockChats);
    });
  });

  describe('getBookingChats', () => {
    it('should get chats by bookingId', async () => {
      const bookingId = '507f1f77bcf86cd799439013';
      const mockChats = [{ _id: new ObjectId(), message: 'Booking chat' }];
      mockCollection.toArray.mockResolvedValue(mockChats);
      const result = await Chat.getBookingChats(bookingId);
      expect(mockCollection.find).toHaveBeenCalledWith({ bookingId: new ObjectId(bookingId) });
      expect(mockCollection.sort).toHaveBeenCalledWith({ createdAt: 1 });
      expect(result).toEqual(mockChats);
    });
  });

  describe('getRecentChats', () => {
    it('should get recent chats for a user', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockResult = [{ otherUser: { _id: new ObjectId(), name: 'User' }, lastMessage: 'Hi', lastMessageTime: new Date() }];
      mockCollection.toArray.mockResolvedValue(mockResult);
      mockCollection.aggregate.mockReturnThis();
      const result = await Chat.getRecentChats(userId);
      expect(mockCollection.aggregate).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('getUnreadMessages', () => {
    it('should get unread messages for a user', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockChats = [{ _id: new ObjectId(), message: 'Unread', read: false }];
      mockCollection.toArray.mockResolvedValue(mockChats);
      const result = await Chat.getUnreadMessages(userId);
      expect(mockCollection.find).toHaveBeenCalledWith({
        receiverId: new ObjectId(userId),
        read: false
      });
      expect(result).toEqual(mockChats);
    });
  });

  describe('setupIndexes', () => {
    it('should create indexes', async () => {
      mockCollection.createIndex.mockResolvedValue({});
      await Chat.setupIndexes();
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ senderId: 1, receiverId: 1, createdAt: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ bookingId: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ createdAt: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ read: 1 });
    });
  });

  describe('create', () => {
    it('should create a chat message', async () => {
      const chatData = { senderId: '507f1f77bcf86cd799439011', receiverId: '507f1f77bcf86cd799439012', message: 'Test', bookingId: '507f1f77bcf86cd799439013' };
      const insertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValue({ insertedId });
      const result = await Chat.create(chatData);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        senderId: new ObjectId(chatData.senderId),
        receiverId: new ObjectId(chatData.receiverId),
        message: chatData.message,
        bookingId: new ObjectId(chatData.bookingId),
        read: false,
        createdAt: expect.any(Date)
      }));
      expect(result._id).toBe(insertedId);
    });
  });

  describe('getHistory', () => {
    it('should get chat history (alias)', async () => {
      const userId1 = '507f1f77bcf86cd799439011';
      const userId2 = '507f1f77bcf86cd799439012';
      const mockChats = [{ _id: new ObjectId(), message: 'Hi' }];
      mockCollection.toArray.mockResolvedValue(mockChats);
      const result = await Chat.getHistory(userId1, userId2);
      expect(mockCollection.find).toHaveBeenCalledWith({
        $or: [
          { senderId: new ObjectId(userId1), receiverId: new ObjectId(userId2) },
          { senderId: new ObjectId(userId2), receiverId: new ObjectId(userId1) }
        ]
      });
      expect(mockCollection.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(mockCollection.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual(mockChats);
    });
  });

  describe('getByBooking', () => {
    it('should get chats by bookingId (alias)', async () => {
      const bookingId = '507f1f77bcf86cd799439013';
      const mockChats = [{ _id: new ObjectId(), message: 'Booking chat' }];
      mockCollection.toArray.mockResolvedValue(mockChats);
      const result = await Chat.getByBooking(bookingId);
      expect(mockCollection.find).toHaveBeenCalledWith({ bookingId: new ObjectId(bookingId) });
      expect(mockCollection.sort).toHaveBeenCalledWith({ createdAt: 1 });
      expect(result).toEqual(mockChats);
    });
  });

  describe('getParticipants', () => {
    it('should get chat participants for a user', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockResult = [{ otherUser: { _id: new ObjectId(), name: 'User' }, lastMessage: 'Hi', lastMessageTime: new Date() }];
      mockCollection.toArray.mockResolvedValue(mockResult);
      mockCollection.aggregate.mockReturnThis();
      const result = await Chat.getParticipants(userId);
      expect(mockCollection.aggregate).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('getUnread', () => {
    it('should get unread messages for a user (alias)', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockChats = [{ _id: new ObjectId(), message: 'Unread', read: false }];
      mockCollection.toArray.mockResolvedValue(mockChats);
      const result = await Chat.getUnread(userId);
      expect(mockCollection.find).toHaveBeenCalledWith({
        receiverId: new ObjectId(userId),
        read: false
      });
      expect(result).toEqual(mockChats);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all messages as read between two users', async () => {
      const senderId = '507f1f77bcf86cd799439011';
      const receiverId = '507f1f77bcf86cd799439012';
      mockCollection.updateMany.mockResolvedValue({ modifiedCount: 3 });
      const result = await Chat.markAllAsRead(senderId, receiverId);
      expect(mockCollection.updateMany).toHaveBeenCalledWith(
        {
          senderId: new ObjectId(senderId),
          receiverId: new ObjectId(receiverId),
          read: false
        },
        { $set: { read: true } }
      );
      expect(result).toEqual({ modifiedCount: 3 });
    });
  });
}); 