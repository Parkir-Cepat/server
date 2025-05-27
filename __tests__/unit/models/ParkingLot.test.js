import { ParkingLot } from '../../../models/ParkingLot.js';
import { getDB } from '../../../config/db.js';
import { ObjectId } from 'mongodb';

jest.mock('../../../config/db.js');

describe('ParkingLot Model', () => {
  let mockDb;
  let mockCollection;

  beforeEach(() => {
    mockCollection = {
      findOne: jest.fn(),
      insertOne: jest.fn(),
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
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
    it('should find parking lot by ID', async () => {
      const id = '507f1f77bcf86cd799439011';
      const mockLot = { _id: new ObjectId(id), name: 'Lot A' };
      mockCollection.findOne.mockResolvedValue(mockLot);
      const result = await ParkingLot.findById(id);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: new ObjectId(id) });
      expect(result).toEqual(mockLot);
    });
  });

  describe('create', () => {
    it('should create a parking lot', async () => {
      const parkingLotData = {
        name: 'Lot A',
        location: { coordinates: [106.8, -6.2] },
        capacity: { car: 10, motorcycle: 20 },
        ownerId: '507f1f77bcf86cd799439012',
        address: 'Jl. Test',
        price: 5000
      };
      const insertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValue({ insertedId });
      const result = await ParkingLot.create(parkingLotData);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        name: parkingLotData.name,
        location: { type: 'Point', coordinates: parkingLotData.location.coordinates },
        available: { car: 10, motorcycle: 20 },
        rating: 0,
        reviewCount: 0,
        status: 'active',
        ownerId: new ObjectId(parkingLotData.ownerId),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }));
      expect(result._id).toBe(insertedId);
    });
  });

  describe('findNearby', () => {
    it('should find nearby parking lots with vehicleType', async () => {
      const mockLots = [{ _id: new ObjectId(), name: 'Lot A' }];
      mockCollection.toArray.mockResolvedValue(mockLots);
      mockCollection.find.mockReturnThis();
      const result = await ParkingLot.findNearby({ longitude: 106.8, latitude: -6.2, maxDistance: 1000, vehicleType: 'car' });
      expect(mockCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        location: expect.any(Object),
        status: 'active',
        'available.car': { $gt: 0 }
      }));
      expect(result).toEqual(mockLots);
    });
    it('should find nearby parking lots without vehicleType', async () => {
      const mockLots = [{ _id: new ObjectId(), name: 'Lot B' }];
      mockCollection.toArray.mockResolvedValue(mockLots);
      mockCollection.find.mockReturnThis();
      const result = await ParkingLot.findNearby({ longitude: 106.8, latitude: -6.2 });
      expect(mockCollection.find).toHaveBeenCalledWith(expect.objectContaining({
        location: expect.any(Object),
        status: 'active'
      }));
      expect(result).toEqual(mockLots);
    });
  });

  describe('updateAvailability', () => {
    it('should update availability for a vehicle type', async () => {
      const parkingLotId = '507f1f77bcf86cd799439011';
      const vehicleType = 'car';
      const change = -1;
      const updatedLot = { _id: new ObjectId(parkingLotId), available: { car: 9, motorcycle: 20 } };
      mockCollection.findOneAndUpdate.mockResolvedValue({ value: updatedLot });
      const result = await ParkingLot.updateAvailability(parkingLotId, vehicleType, change);
      const updateQuery = {};
      updateQuery['available.' + vehicleType] = change;
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new ObjectId(parkingLotId) },
        { $inc: updateQuery, $set: { updatedAt: expect.any(Date) } },
        { returnDocument: 'after' }
      );
      expect(result).toEqual(updatedLot);
    });
  });

  describe('updateRating', () => {
    it('should update rating and reviewCount', async () => {
      const parkingLotId = '507f1f77bcf86cd799439011';
      const mockLot = { _id: new ObjectId(parkingLotId), rating: 4.0, reviewCount: 2 };
      mockCollection.findOne.mockResolvedValue(mockLot);
      const updatedLot = { ...mockLot, rating: 4.3, reviewCount: 3 };
      mockCollection.findOneAndUpdate.mockResolvedValue({ value: updatedLot });
      const result = await ParkingLot.updateRating(parkingLotId, 5);
      expect(result).toEqual(updatedLot);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalled();
    });
    it('should throw error if parking lot not found', async () => {
      const validId = '507f1f77bcf86cd799439011';
      mockCollection.findOne.mockResolvedValue(null);
      await expect(ParkingLot.updateRating(validId, 5)).rejects.toThrow('Tempat parkir tidak ditemukan');
    });
  });

  describe('findByOwner', () => {
    it('should find parking lots by owner', async () => {
      const ownerId = '507f1f77bcf86cd799439012';
      const mockLots = [{ _id: new ObjectId(), ownerId: new ObjectId(ownerId) }];
      mockCollection.toArray.mockResolvedValue(mockLots);
      mockCollection.find.mockReturnThis();
      const result = await ParkingLot.findByOwner(ownerId);
      expect(mockCollection.find).toHaveBeenCalledWith({ ownerId: new ObjectId(ownerId), status: 'active' });
      expect(result).toEqual(mockLots);
    });
  });

  describe('update', () => {
    it('should update parking lot data', async () => {
      const parkingLotId = '507f1f77bcf86cd799439011';
      const updateData = { name: 'Lot Updated', price: 6000 };
      const updatedLot = { _id: new ObjectId(parkingLotId), name: 'Lot Updated', price: 6000 };
      mockCollection.findOneAndUpdate.mockResolvedValue({ value: updatedLot });
      const result = await ParkingLot.update(parkingLotId, updateData);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new ObjectId(parkingLotId) },
        { $set: expect.objectContaining({ ...updateData, updatedAt: expect.any(Date) }) },
        { returnDocument: 'after' }
      );
      expect(result).toEqual(updatedLot);
    });
  });

  describe('delete', () => {
    it('should soft delete parking lot', async () => {
      const parkingLotId = '507f1f77bcf86cd799439011';
      const deletedLot = { _id: new ObjectId(parkingLotId), status: 'inactive' };
      mockCollection.findOneAndUpdate.mockResolvedValue({ value: deletedLot });
      const result = await ParkingLot.delete(parkingLotId);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new ObjectId(parkingLotId) },
        { $set: { status: 'inactive', updatedAt: expect.any(Date) } },
        { returnDocument: 'after' }
      );
      expect(result).toEqual(deletedLot);
    });
  });

  describe('setupIndexes', () => {
    it('should create indexes', async () => {
      mockCollection.createIndex.mockResolvedValue({});
      await ParkingLot.setupIndexes();
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ location: '2dsphere' });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ ownerId: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ status: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ rating: -1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ createdAt: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ name: 'text', address: 'text' });
    });
  });
}); 