/**
 * @jest-environment node
 */

import { UserRoom } from '../../../models/UserRoom.js';
import { ObjectId } from 'mongodb';

// Global mocks
global.ObjectId = ObjectId;

// Mock dependencies
jest.mock('../../../config/db.js');

describe('UserRoom Model', () => {
  let mockDB, mockCollection;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCollection = {
      findOne: jest.fn(),
      insertOne: jest.fn(),
      find: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
      countDocuments: jest.fn(),
      createIndex: jest.fn().mockResolvedValue(),
      aggregate: jest.fn(),
      toArray: jest.fn()
    };

    mockCollection.find.mockReturnValue(mockCollection);
    mockCollection.aggregate.mockReturnValue(mockCollection);

    mockDB = {
      collection: jest.fn().mockReturnValue(mockCollection)
    };

    const { getDB } = require('../../../config/db.js');
    getDB.mockReturnValue(mockDB);
  });

  describe('setupIndexes', () => {
    it('should create all indexes successfully', async () => {
      await UserRoom.setupIndexes();

      expect(mockDB.collection).toHaveBeenCalledWith('userRooms');
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ user_id: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ room_id: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith(
        { user_id: 1, room_id: 1 }, 
        { unique: true }
      );
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ created_at: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledTimes(4);
    });

    it('should handle partial index creation failure', async () => {
      // First two indexes succeed, third one fails
      mockCollection.createIndex
        .mockResolvedValueOnce('index1')
        .mockResolvedValueOnce('index2')
        .mockRejectedValueOnce(new Error('Failed to create compound index'))
        .mockResolvedValueOnce('index4');

      await expect(UserRoom.setupIndexes()).rejects.toThrow('Failed to create compound index');
    });

    it('should handle all index creation failures', async () => {
      const error = new Error('Index creation failed');
      mockCollection.createIndex.mockRejectedValue(error);

      await expect(UserRoom.setupIndexes()).rejects.toThrow('Index creation failed');
    });

    it('should handle database connection errors', async () => {
      mockDB.collection.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(UserRoom.setupIndexes()).rejects.toThrow('Database connection failed');
    });
  });

  describe('findById', () => {
    it('should find user room by id successfully', async () => {
      const userRoomId = new ObjectId();
      const mockUserRoom = {
        _id: userRoomId,
        user_id: new ObjectId(),
        room_id: new ObjectId(),
        created_at: new Date()
      };

      mockCollection.findOne.mockResolvedValue(mockUserRoom);

      const result = await UserRoom.findById(userRoomId.toString());

      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: userRoomId });
      expect(result).toEqual(mockUserRoom);
    });

    it('should handle invalid ObjectId format', async () => {
      await expect(UserRoom.findById('invalid-id')).rejects.toThrow();
    });

    it('should return null if user room not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await UserRoom.findById(new ObjectId().toString());

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockCollection.findOne.mockRejectedValue(new Error('Database error'));

      await expect(UserRoom.findById(new ObjectId().toString())).rejects.toThrow('Database error');
    });
  });

  describe('create', () => {
    it('should create user room successfully', async () => {
      const userRoomData = {
        user_id: new ObjectId().toString(),
        room_id: new ObjectId().toString()
      };

      const mockInsertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

      const result = await UserRoom.create(userRoomData);

      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        user_id: new ObjectId(userRoomData.user_id),
        room_id: new ObjectId(userRoomData.room_id),
        created_at: expect.any(Date)
      });

      expect(result).toEqual({
        _id: mockInsertedId,
        user_id: new ObjectId(userRoomData.user_id),
        room_id: new ObjectId(userRoomData.room_id),
        created_at: expect.any(Date)
      });
    });

    it('should create user room with ObjectId inputs', async () => {
      const userRoomData = {
        user_id: new ObjectId(),
        room_id: new ObjectId()
      };

      const mockInsertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

      const result = await UserRoom.create(userRoomData);

      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        user_id: userRoomData.user_id,
        room_id: userRoomData.room_id,
        created_at: expect.any(Date)
      });
    });

    it('should handle invalid user_id format', async () => {
      const userRoomData = {
        user_id: 'invalid-id',
        room_id: new ObjectId().toString()
      };

      await expect(UserRoom.create(userRoomData)).rejects.toThrow();
    });

    it('should handle invalid room_id format', async () => {
      const userRoomData = {
        user_id: new ObjectId().toString(),
        room_id: 'invalid-id'
      };

      await expect(UserRoom.create(userRoomData)).rejects.toThrow();
    });

    it('should handle missing required fields', async () => {
      const userRoomData = {
        user_id: new ObjectId().toString()
        // missing room_id
      };

      await expect(UserRoom.create(userRoomData)).rejects.toThrow();
    });

    it('should handle database errors during creation', async () => {
      const userRoomData = {
        user_id: new ObjectId().toString(),
        room_id: new ObjectId().toString()
      };

      mockCollection.insertOne.mockRejectedValue(new Error('Insert failed'));

      await expect(UserRoom.create(userRoomData)).rejects.toThrow('Insert failed');
    });

    it('should handle duplicate user-room combination', async () => {
      const userRoomData = {
        user_id: new ObjectId().toString(),
        room_id: new ObjectId().toString()
      };

      const duplicateError = new Error('E11000 duplicate key error');
      duplicateError.code = 11000;
      mockCollection.insertOne.mockRejectedValue(duplicateError);

      await expect(UserRoom.create(userRoomData)).rejects.toThrow('E11000 duplicate key error');
    });
  });

  describe('findByUserId', () => {
    it('should find user rooms by user id', async () => {
      const userId = new ObjectId();
      const mockUserRooms = [
        {
          _id: new ObjectId(),
          user_id: userId,
          room_id: new ObjectId(),
          created_at: new Date()
        },
        {
          _id: new ObjectId(),
          user_id: userId,
          room_id: new ObjectId(),
          created_at: new Date()
        }
      ];

      mockCollection.toArray.mockResolvedValue(mockUserRooms);

      const result = await UserRoom.findByUserId(userId.toString());

      expect(mockCollection.find).toHaveBeenCalledWith({ user_id: userId });
      expect(result).toEqual(mockUserRooms);
    });

    it('should return empty array if no user rooms found', async () => {
      mockCollection.toArray.mockResolvedValue([]);

      const result = await UserRoom.findByUserId(new ObjectId().toString());

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockCollection.toArray.mockRejectedValue(new Error('Database error'));

      await expect(UserRoom.findByUserId(new ObjectId().toString())).rejects.toThrow('Database error');
    });
  });

  describe('findByRoomId', () => {
    it('should find user rooms by room id', async () => {
      const roomId = new ObjectId();
      const mockUserRooms = [
        {
          _id: new ObjectId(),
          user_id: new ObjectId(),
          room_id: roomId,
          created_at: new Date()
        },
        {
          _id: new ObjectId(),
          user_id: new ObjectId(),
          room_id: roomId,
          created_at: new Date()
        }
      ];

      mockCollection.toArray.mockResolvedValue(mockUserRooms);

      const result = await UserRoom.findByRoomId(roomId.toString());

      expect(mockCollection.find).toHaveBeenCalledWith({ room_id: roomId });
      expect(result).toEqual(mockUserRooms);
    });

    it('should return empty array if no users in room', async () => {
      mockCollection.toArray.mockResolvedValue([]);

      const result = await UserRoom.findByRoomId(new ObjectId().toString());

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockCollection.toArray.mockRejectedValue(new Error('Database error'));

      await expect(UserRoom.findByRoomId(new ObjectId().toString())).rejects.toThrow('Database error');
    });
  });

  describe('findUserRooms', () => {
    it('should find user rooms with room details', async () => {
      const userId = new ObjectId();
      const mockResult = [
        {
          _id: new ObjectId(),
          user_id: userId,
          room_id: new ObjectId(),
          room: {
            _id: new ObjectId(),
            nameRoom: 'General Chat',
            type: 'general',
            privacy: 'public'
          }
        }
      ];

      mockCollection.toArray.mockResolvedValue(mockResult);

      const result = await UserRoom.findUserRooms(userId.toString());

      expect(mockCollection.aggregate).toHaveBeenCalledWith([
        {
          $match: { user_id: userId }
        },
        {
          $lookup: {
            from: "rooms",
            localField: "room_id",
            foreignField: "_id",
            as: "room"
          }
        },
        {
          $unwind: "$room"
        }
      ]);

      expect(result).toEqual(mockResult);
    });

    it('should handle multiple rooms per user', async () => {
      const userId = new ObjectId();
      const mockResult = [
        {
          _id: new ObjectId(),
          user_id: userId,
          room_id: new ObjectId(),
          room: {
            _id: new ObjectId(),
            nameRoom: 'Room 1',
            type: 'general'
          }
        },
        {
          _id: new ObjectId(),
          user_id: userId,
          room_id: new ObjectId(),
          room: {
            _id: new ObjectId(),
            nameRoom: 'Room 2',
            type: 'private'
          }
        }
      ];

      mockCollection.toArray.mockResolvedValue(mockResult);

      const result = await UserRoom.findUserRooms(userId.toString());

      expect(result).toHaveLength(2);
      expect(result).toEqual(mockResult);
    });

    it('should handle empty $lookup results', async () => {
      mockCollection.toArray.mockResolvedValue([]);

      const result = await UserRoom.findUserRooms(new ObjectId().toString());

      expect(result).toEqual([]);
    });

    it('should handle invalid user id', async () => {
      await expect(UserRoom.findUserRooms('invalid-id')).rejects.toThrow();
    });

    it('should handle database errors', async () => {
      mockCollection.toArray.mockRejectedValue(new Error('Aggregation failed'));

      await expect(UserRoom.findUserRooms(new ObjectId().toString())).rejects.toThrow('Aggregation failed');
    });

    it('should handle $lookup pipeline errors', async () => {
      mockCollection.aggregate.mockImplementation(() => {
        throw new Error('Lookup pipeline error');
      });

      await expect(UserRoom.findUserRooms(new ObjectId().toString())).rejects.toThrow('Lookup pipeline error');
    });
  });

  describe('findRoomUsers', () => {
    it('should find room users with user details', async () => {
      const roomId = new ObjectId();
      const mockResult = [
        {
          _id: new ObjectId(),
          user_id: new ObjectId(),
          room_id: roomId,
          user: {
            _id: new ObjectId(),
            username: 'john_doe',
            email: 'john@example.com',
            name: 'John Doe'
          }
        }
      ];

      mockCollection.toArray.mockResolvedValue(mockResult);

      const result = await UserRoom.findRoomUsers(roomId.toString());

      expect(mockCollection.aggregate).toHaveBeenCalledWith([
        {
          $match: { room_id: roomId }
        },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            as: "user"
          }
        },
        {
          $unwind: "$user"
        }
      ]);

      expect(result).toEqual(mockResult);
    });

    it('should handle multiple users in room', async () => {
      const roomId = new ObjectId();
      const mockResult = [
        {
          _id: new ObjectId(),
          user_id: new ObjectId(),
          room_id: roomId,
          user: {
            _id: new ObjectId(),
            username: 'user1',
            email: 'user1@example.com',
            name: 'User One'
          }
        },
        {
          _id: new ObjectId(),
          user_id: new ObjectId(),
          room_id: roomId,
          user: {
            _id: new ObjectId(),
            username: 'user2',
            email: 'user2@example.com',
            name: 'User Two'
          }
        }
      ];

      mockCollection.toArray.mockResolvedValue(mockResult);

      const result = await UserRoom.findRoomUsers(roomId.toString());

      expect(result).toHaveLength(2);
      expect(result).toEqual(mockResult);
    });

    it('should handle invalid room id', async () => {
      await expect(UserRoom.findRoomUsers('invalid-id')).rejects.toThrow();
    });

    it('should return empty array when room has no users', async () => {
      mockCollection.toArray.mockResolvedValue([]);

      const result = await UserRoom.findRoomUsers(new ObjectId().toString());

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockCollection.toArray.mockRejectedValue(new Error('Aggregation failed'));

      await expect(UserRoom.findRoomUsers(new ObjectId().toString())).rejects.toThrow('Aggregation failed');
    });
  });

  describe('delete', () => {
    it('should delete user room successfully', async () => {
      const userId = new ObjectId();
      const roomId = new ObjectId();

      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await UserRoom.delete(userId.toString(), roomId.toString());

      expect(mockCollection.deleteOne).toHaveBeenCalledWith({
        user_id: userId,
        room_id: roomId
      });
      expect(result).toBe(true);
    });

    it('should return false if user room not found', async () => {
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 0 });

      const result = await UserRoom.delete(new ObjectId().toString(), new ObjectId().toString());

      expect(result).toBe(false);
    });

    it('should handle invalid user id format', async () => {
      await expect(UserRoom.delete('invalid-id', new ObjectId().toString())).rejects.toThrow();
    });

    it('should handle invalid room id format', async () => {
      await expect(UserRoom.delete(new ObjectId().toString(), 'invalid-id')).rejects.toThrow();
    });

    it('should handle database errors', async () => {
      mockCollection.deleteOne.mockRejectedValue(new Error('Delete failed'));

      await expect(
        UserRoom.delete(new ObjectId().toString(), new ObjectId().toString())
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('isUserInRoom', () => {
    it('should return true if user is in room', async () => {
      const userId = new ObjectId();
      const roomId = new ObjectId();

      mockCollection.countDocuments.mockResolvedValue(1);

      const result = await UserRoom.isUserInRoom(userId.toString(), roomId.toString());

      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        user_id: userId,
        room_id: roomId
      });
      expect(result).toBe(true);
    });

    it('should return false if user is not in room', async () => {
      mockCollection.countDocuments.mockResolvedValue(0);

      const result = await UserRoom.isUserInRoom(new ObjectId().toString(), new ObjectId().toString());

      expect(result).toBe(false);
    });

    it('should handle invalid user id format', async () => {
      await expect(UserRoom.isUserInRoom('invalid-id', new ObjectId().toString())).rejects.toThrow();
    });

    it('should handle invalid room id format', async () => {
      await expect(UserRoom.isUserInRoom(new ObjectId().toString(), 'invalid-id')).rejects.toThrow();
    });

    it('should handle database errors', async () => {
      mockCollection.countDocuments.mockRejectedValue(new Error('Count failed'));

      await expect(
        UserRoom.isUserInRoom(new ObjectId().toString(), new ObjectId().toString())
      ).rejects.toThrow('Count failed');
    });
  });

  describe('countByRoom', () => {
    it('should count users in room correctly', async () => {
      const roomId = new ObjectId();
      mockCollection.countDocuments.mockResolvedValue(5);

      const result = await UserRoom.countByRoom(roomId.toString());

      expect(mockCollection.countDocuments).toHaveBeenCalledWith({
        room_id: roomId
      });
      expect(result).toBe(5);
    });

    it('should return 0 for empty room', async () => {
      mockCollection.countDocuments.mockResolvedValue(0);

      const result = await UserRoom.countByRoom(new ObjectId().toString());

      expect(result).toBe(0);
    });

    it('should handle invalid room id format', async () => {
      await expect(UserRoom.countByRoom('invalid-id')).rejects.toThrow();
    });

    it('should handle database errors', async () => {
      mockCollection.countDocuments.mockRejectedValue(new Error('Count failed'));

      await expect(UserRoom.countByRoom(new ObjectId().toString())).rejects.toThrow('Count failed');
    });
  });

  describe('findByUserAndRoom', () => {
    it('should find user room by user and room ids', async () => {
      const userId = new ObjectId();
      const roomId = new ObjectId();
      const mockUserRoom = {
        _id: new ObjectId(),
        user_id: userId,
        room_id: roomId,
        created_at: new Date()
      };

      mockCollection.findOne.mockResolvedValue(mockUserRoom);

      const result = await UserRoom.findByUserAndRoom(userId.toString(), roomId.toString());

      expect(mockCollection.findOne).toHaveBeenCalledWith({
        user_id: userId,
        room_id: roomId
      });
      expect(result).toEqual(mockUserRoom);
    });

    it('should return null if user-room combination not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await UserRoom.findByUserAndRoom(new ObjectId().toString(), new ObjectId().toString());

      expect(result).toBeNull();
    });

    it('should handle invalid user id format', async () => {
      await expect(UserRoom.findByUserAndRoom('invalid-id', new ObjectId().toString())).rejects.toThrow();
    });

    it('should handle invalid room id format', async () => {
      await expect(UserRoom.findByUserAndRoom(new ObjectId().toString(), 'invalid-id')).rejects.toThrow();
    });

    it('should handle database errors', async () => {
      mockCollection.findOne.mockRejectedValue(new Error('Database error'));

      await expect(
        UserRoom.findByUserAndRoom(new ObjectId().toString(), new ObjectId().toString())
      ).rejects.toThrow('Database error');
    });
  });
});
