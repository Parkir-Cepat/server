/**
 * @jest-environment node
 */

import { Room } from '../../../models/Room.js';
import { UserRoom } from '../../../models/UserRoom.js';
import { ObjectId } from 'mongodb';

// Global mocks
global.ObjectId = ObjectId;

// Mock dependencies
jest.mock('../../../config/db.js');
jest.mock('../../../models/UserRoom.js');

describe('Room Model', () => {
  let mockDB, mockCollection;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCollection = {
      findOne: jest.fn(),
      insertOne: jest.fn(),
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      createIndex: jest.fn().mockResolvedValue(),
      limit: jest.fn(),
      sort: jest.fn(),
      toArray: jest.fn()
    };

    mockCollection.find.mockReturnValue(mockCollection);
    mockCollection.limit.mockReturnValue(mockCollection);
    mockCollection.sort.mockReturnValue(mockCollection);

    mockDB = {
      collection: jest.fn().mockReturnValue(mockCollection)
    };

    const { getDB } = require('../../../config/db.js');
    getDB.mockReturnValue(mockDB);
  });

  describe('setupIndexes', () => {
    it('should create indexes successfully', async () => {
      await Room.setupIndexes();

      expect(mockDB.collection).toHaveBeenCalledWith('rooms');
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ nameRoom: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ created_at: 1 });
    });

    it('should handle index creation errors', async () => {
      mockCollection.createIndex.mockRejectedValue(new Error('Index creation failed'));

      await expect(Room.setupIndexes()).rejects.toThrow('Index creation failed');
    });
  });

  describe('findById', () => {
    it('should find room by id successfully', async () => {
      const roomId = new ObjectId();
      const mockRoom = {
        _id: roomId,
        nameRoom: 'Test Room',
        type: 'general',
        privacy: 'public'
      };

      mockCollection.findOne.mockResolvedValue(mockRoom);

      const result = await Room.findById(roomId.toString());

      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: roomId });
      expect(result).toEqual(mockRoom);
    });

    it('should return null if room not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await Room.findById(new ObjectId().toString());

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockCollection.findOne.mockRejectedValue(new Error('Database error'));

      await expect(Room.findById(new ObjectId().toString())).rejects.toThrow('Database error');
    });
  });

  describe('create', () => {
    it('should create room with all fields', async () => {
      const roomData = {
        nameRoom: 'Test Room',
        type: 'private',
        privacy: 'private',
        creator_id: new ObjectId().toString(),
        max_participants: 10,
        parking_id: new ObjectId().toString()
      };

      const mockInsertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

      const result = await Room.create(roomData);

      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        nameRoom: roomData.nameRoom,
        type: roomData.type,
        privacy: roomData.privacy,
        creator_id: roomData.creator_id,
        max_participants: roomData.max_participants,
        parking_id: roomData.parking_id,
        created_at: expect.any(Date),
        updated_at: expect.any(Date)
      });

      expect(result).toEqual({
        _id: mockInsertedId,
        nameRoom: roomData.nameRoom,
        type: roomData.type,
        privacy: roomData.privacy,
        creator_id: roomData.creator_id,
        max_participants: roomData.max_participants,
        parking_id: roomData.parking_id,
        created_at: expect.any(Date),
        updated_at: expect.any(Date)
      });
    });

    it('should create room with default values', async () => {
      const roomData = {
        nameRoom: 'Test Room',
        creator_id: new ObjectId().toString()
      };

      const mockInsertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

      const result = await Room.create(roomData);

      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        nameRoom: roomData.nameRoom,
        type: 'general',
        privacy: 'public',
        creator_id: roomData.creator_id,
        max_participants: null,
        parking_id: null,
        created_at: expect.any(Date),
        updated_at: expect.any(Date)
      });

      expect(result.type).toBe('general');
      expect(result.privacy).toBe('public');
      expect(result.max_participants).toBeNull();
      expect(result.parking_id).toBeNull();
    });

    it('should handle database errors during creation', async () => {
      const roomData = {
        nameRoom: 'Test Room',
        creator_id: new ObjectId().toString()
      };

      mockCollection.insertOne.mockRejectedValue(new Error('Insert failed'));

      await expect(Room.create(roomData)).rejects.toThrow('Insert failed');
    });
  });

  describe('findAll', () => {
    it('should return all rooms', async () => {
      const mockRooms = [
        { _id: new ObjectId(), nameRoom: 'Room 1' },
        { _id: new ObjectId(), nameRoom: 'Room 2' }
      ];

      mockCollection.toArray.mockResolvedValue(mockRooms);

      const result = await Room.findAll();

      expect(mockCollection.find).toHaveBeenCalledWith({});
      expect(mockCollection.toArray).toHaveBeenCalled();
      expect(result).toEqual(mockRooms);
    });

    it('should return empty array if no rooms found', async () => {
      mockCollection.toArray.mockResolvedValue([]);

      const result = await Room.findAll();

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      mockCollection.toArray.mockRejectedValue(new Error('Database error'));

      await expect(Room.findAll()).rejects.toThrow('Database error');
    });
  });

  describe('update', () => {
    it('should update room successfully', async () => {
      const roomId = new ObjectId();
      const updateData = {
        nameRoom: 'Updated Room',
        type: 'private'
      };

      const updatedRoom = {
        _id: roomId,
        nameRoom: 'Updated Room',
        type: 'private',
        updated_at: expect.any(Date)
      };

      mockCollection.findOneAndUpdate.mockResolvedValue({ value: updatedRoom });

      const result = await Room.update(roomId.toString(), updateData);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: roomId },
        {
          $set: {
            ...updateData,
            updated_at: expect.any(Date)
          }
        },
        { returnDocument: "after" }
      );

      expect(result).toEqual({ value: updatedRoom });
    });

    it('should handle update errors', async () => {
      mockCollection.findOneAndUpdate.mockRejectedValue(new Error('Update failed'));

      await expect(Room.update(new ObjectId().toString(), {})).rejects.toThrow('Update failed');
    });
  });

  describe('delete', () => {
    it('should delete room successfully', async () => {
      const roomId = new ObjectId();
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 1 });

      const result = await Room.delete(roomId.toString());

      expect(mockCollection.deleteOne).toHaveBeenCalledWith({ _id: roomId });
      expect(result).toBe(true);
    });

    it('should return false if room not found', async () => {
      mockCollection.deleteOne.mockResolvedValue({ deletedCount: 0 });

      const result = await Room.delete(new ObjectId().toString());

      expect(result).toBe(false);
    });

    it('should handle delete errors', async () => {
      mockCollection.deleteOne.mockRejectedValue(new Error('Delete failed'));

      await expect(Room.delete(new ObjectId().toString())).rejects.toThrow('Delete failed');
    });
  });

  describe('findByIds', () => {
    it('should find multiple rooms by IDs', async () => {
      const roomIds = [new ObjectId(), new ObjectId()];
      const mockRooms = [
        { _id: roomIds[0], nameRoom: 'Room 1' },
        { _id: roomIds[1], nameRoom: 'Room 2' }
      ];

      mockCollection.toArray.mockResolvedValue(mockRooms);

      const result = await Room.findByIds(roomIds.map(id => id.toString()));

      expect(mockCollection.find).toHaveBeenCalledWith({
        _id: { $in: roomIds }
      });
      expect(result).toEqual(mockRooms);
    });

    it('should handle empty IDs array', async () => {
      mockCollection.toArray.mockResolvedValue([]);

      const result = await Room.findByIds([]);

      expect(mockCollection.find).toHaveBeenCalledWith({
        _id: { $in: [] }
      });
      expect(result).toEqual([]);
    });
  });

  describe('findPublicRooms', () => {
    it('should find public rooms with default limit', async () => {
      const mockRooms = [
        { _id: new ObjectId(), nameRoom: 'Public Room 1', privacy: 'public' }
      ];

      mockCollection.toArray.mockResolvedValue(mockRooms);

      const result = await Room.findPublicRooms();

      expect(mockCollection.find).toHaveBeenCalledWith({ privacy: 'public' });
      expect(mockCollection.limit).toHaveBeenCalledWith(10);
      expect(mockCollection.sort).toHaveBeenCalledWith({ created_at: -1 });
      expect(result).toEqual(mockRooms);
    });

    it('should find public rooms with custom limit', async () => {
      const mockRooms = [];
      mockCollection.toArray.mockResolvedValue(mockRooms);

      const result = await Room.findPublicRooms(5);

      expect(mockCollection.limit).toHaveBeenCalledWith(5);
      expect(result).toEqual(mockRooms);
    });

    it('should find public rooms filtered by parking_id', async () => {
      const parkingId = new ObjectId().toString();
      const mockRooms = [];
      mockCollection.toArray.mockResolvedValue(mockRooms);

      const result = await Room.findPublicRooms(10, parkingId);

      expect(mockCollection.find).toHaveBeenCalledWith({
        privacy: 'public',
        parking_id: parkingId
      });
      expect(result).toEqual(mockRooms);
    });
  });

  describe('findPrivateRoomBetweenUsers', () => {
    it('should find private room between two users', async () => {
      const user1Id = new ObjectId().toString();
      const user2Id = new ObjectId().toString();
      const roomId = new ObjectId();
      
      const mockRoom = {
        _id: roomId,
        privacy: 'private',
        type: 'direct'
      };

      const mockParticipants = [
        { user_id: new ObjectId(user1Id) },
        { user_id: new ObjectId(user2Id) }
      ];

      mockCollection.toArray.mockResolvedValue([mockRoom]);
      UserRoom.findByRoomId.mockResolvedValue(mockParticipants);

      const result = await Room.findPrivateRoomBetweenUsers(user1Id, user2Id);

      expect(mockCollection.find).toHaveBeenCalledWith({
        privacy: 'private',
        type: 'direct'
      });
      expect(UserRoom.findByRoomId).toHaveBeenCalledWith(roomId);
      expect(result).toEqual(mockRoom);
    });

    it('should find private room between users with parking filter', async () => {
      const user1Id = new ObjectId().toString();
      const user2Id = new ObjectId().toString();
      const parkingId = new ObjectId().toString();

      mockCollection.toArray.mockResolvedValue([]);

      const result = await Room.findPrivateRoomBetweenUsers(user1Id, user2Id, parkingId);

      expect(mockCollection.find).toHaveBeenCalledWith({
        privacy: 'private',
        type: 'direct',
        parking_id: parkingId
      });
      expect(result).toBeNull();
    });

    it('should return null if no room found', async () => {
      const user1Id = new ObjectId().toString();
      const user2Id = new ObjectId().toString();

      mockCollection.toArray.mockResolvedValue([]);

      const result = await Room.findPrivateRoomBetweenUsers(user1Id, user2Id);

      expect(result).toBeNull();
    });

    it('should return null if users are not both participants', async () => {
      const user1Id = new ObjectId().toString();
      const user2Id = new ObjectId().toString();
      const user3Id = new ObjectId().toString();
      const roomId = new ObjectId();
      
      const mockRoom = {
        _id: roomId,
        privacy: 'private',
        type: 'direct'
      };

      const mockParticipants = [
        { user_id: new ObjectId(user1Id) },
        { user_id: new ObjectId(user3Id) } // Different user
      ];

      mockCollection.toArray.mockResolvedValue([mockRoom]);
      UserRoom.findByRoomId.mockResolvedValue(mockParticipants);

      const result = await Room.findPrivateRoomBetweenUsers(user1Id, user2Id);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockCollection.toArray.mockRejectedValue(new Error('Database error'));

      await expect(
        Room.findPrivateRoomBetweenUsers('user1', 'user2')
      ).rejects.toThrow('Database error');
    });
  });
});
