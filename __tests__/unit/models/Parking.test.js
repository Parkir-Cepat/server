import { Parking } from '../../../models/Parking.js';
import { getDB } from '../../../config/db.js';
import { ObjectId } from 'mongodb';

jest.mock('../../../config/db.js');

describe('Parking Model', () => {
  let mockDb;
  let mockCollection;

  beforeEach(() => {
    mockCollection = {
      findOne: jest.fn(),
      insertOne: jest.fn(),
      find: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
      findOneAndUpdate: jest.fn(),
      createIndex: jest.fn()
    };
    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection)
    };
    getDB.mockReturnValue(mockDb);
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should find parking by ID', async () => {
      const id = '507f1f77bcf86cd799439011';
      const mockParking = { _id: new ObjectId(id), name: 'Parkir A' };
      mockCollection.findOne.mockResolvedValue(mockParking);
      const result = await Parking.findById(id);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: new ObjectId(id) });
      expect(result).toEqual(mockParking);
    });
  });

  describe('create', () => {
    it('should create a parking', async () => {
      const parkingData = {
        name: 'Parkir A',
        location: { coordinates: [106.8, -6.2] },
        totalSlots: 10,
        ownerId: '507f1f77bcf86cd799439012',
        address: 'Jl. Test',
      };
      const insertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValue({ insertedId });
      const result = await Parking.create(parkingData);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        name: parkingData.name,
        location: { type: 'Point', coordinates: parkingData.location.coordinates },
        availableSlots: parkingData.totalSlots,
        createdAt: expect.any(Date)
      }));
      expect(result._id).toBe(insertedId);
    });
  });

  describe('findNearby', () => {
    it('should find nearby parkings', async () => {
      const mockParkings = [{ _id: new ObjectId(), name: 'Parkir A' }];
      mockCollection.toArray.mockResolvedValue(mockParkings);
      mockCollection.find.mockReturnThis();
      const result = await Parking.findNearby({ longitude: 106.8, latitude: -6.2, maxDistance: 1000 });
      expect(mockCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        location: expect.any(Object),
        availableSlots: { $gt: 0 }
      }));
      expect(result).toEqual(mockParkings);
    });
  });

  describe('updateAvailability', () => {
    it('should update availability if parking exists and slot valid', async () => {
      const parkingId = '507f1f77bcf86cd799439011';
      const mockParking = { _id: new ObjectId(parkingId), availableSlots: 5, totalSlots: 10 };
      mockCollection.findOne.mockResolvedValue(mockParking);
      const updatedParking = { ...mockParking, availableSlots: 6 };
      mockCollection.findOneAndUpdate.mockResolvedValue({ value: updatedParking });
      const result = await Parking.updateAvailability(parkingId, 1);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new ObjectId(parkingId) },
        { $inc: { availableSlots: 1 } },
        { returnDocument: 'after' }
      );
      expect(result).toEqual(updatedParking);
    });
    it('should throw error if parking not found', async () => {
      const validId = '507f1f77bcf86cd799439011';
      mockCollection.findOne.mockResolvedValue(null);
      await expect(Parking.updateAvailability(validId, 1)).rejects.toThrow('Tempat parkir tidak ditemukan');
    });
    it('should throw error if slot not valid', async () => {
      const parkingId = '507f1f77bcf86cd799439011';
      const mockParking = { _id: new ObjectId(parkingId), availableSlots: 0, totalSlots: 10 };
      mockCollection.findOne.mockResolvedValue(mockParking);
      await expect(Parking.updateAvailability(parkingId, -1)).rejects.toThrow('Slot parkir tidak valid');
    });
  });

  describe('findByOwner', () => {
    it('should find parkings by owner', async () => {
      const ownerId = '507f1f77bcf86cd799439012';
      const mockParkings = [{ _id: new ObjectId(), ownerId: new ObjectId(ownerId) }];
      mockCollection.toArray.mockResolvedValue(mockParkings);
      mockCollection.find.mockReturnThis();
      const result = await Parking.findByOwner(ownerId);
      expect(mockCollection.find).toHaveBeenCalledWith({ ownerId: new ObjectId(ownerId) });
      expect(result).toEqual(mockParkings);
    });
  });

  describe('createIndexes', () => {
    it('should create indexes', async () => {
      mockCollection.createIndex.mockResolvedValue({});
      await Parking.createIndexes();
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ location: '2dsphere' });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ ownerId: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ createdAt: 1 });
    });
  });
}); 