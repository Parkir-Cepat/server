import { Parking } from '../../../graphql/resolvers/parkingResolver';
import { getDB } from '../../../config/db';

jest.mock('../../../config/db', () => ({
  getDB: jest.fn()
}));

// Mock ObjectId to avoid BSONError
jest.mock('mongodb', () => ({
  ObjectId: jest.fn().mockImplementation((id) => id)
}));

describe('Parking Resolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setupIndexes', () => {
    it('should create indexes for the parking collection', async () => {
      const mockCollection = {
        createIndex: jest.fn()
      };
      const mockDb = {
        collection: jest.fn(() => mockCollection)
      };
      getDB.mockReturnValue(mockDb);

      await Parking.setupIndexes();

      expect(mockDb.collection).toHaveBeenCalledWith('parkings');
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ location: '2dsphere' });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ owner_id: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ created_at: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ name: "text", description: "text" });
      expect(mockCollection.createIndex).toHaveBeenCalledTimes(4);
    });
  });

  describe('findById', () => {
    it('returns null when not found', async () => {
      const mockDb = { collection: jest.fn(() => ({ findOne: jest.fn().mockResolvedValue(null) })) };
      getDB.mockReturnValue(mockDb);
      const result = await Parking.findById('123');
      expect(result).toBeNull();
    });
    it('applies default available when missing', async () => {
      const doc = { _id: '1', available: {} };
      const mockCollection = { findOne: jest.fn().mockResolvedValue(doc) };
      getDB.mockReturnValue({ collection: () => mockCollection });
      const result = await Parking.findById('1');
      expect(result.available).toEqual({ car: 0, motorcycle: 0 });
    });
    it('preserves provided available values', async () => {
      const doc = { _id: '2', available: { car: 2, motorcycle: 3 } };
      const mockCollection = { findOne: jest.fn().mockResolvedValue(doc) };
      getDB.mockReturnValue({ collection: () => mockCollection });
      const result = await Parking.findById('2');
      expect(result.available).toEqual({ car: 2, motorcycle: 3 });
    });
  });

  describe('create', () => {
    const input = {
      name: 'P', address: 'A', location: { coordinates: [10, 20] },
      capacity: { car: 5, motorcycle: 6 }, available: { car: 1, bike: 2 },
      rates: { car: 10, motorcycle: 20 }, operational_hours: { open: '08:00', close: '18:00' },
      facilities: ['f'], images: ['i'], status: 'inactive', owner_id: 'oid'
    };
    it('inserts correct document and returns new object', async () => {
      const mockIns = jest.fn().mockResolvedValue({ insertedId: 'nid' });
      getDB.mockReturnValue({ collection: () => ({ insertOne: mockIns }) });
      const res = await Parking.create(input);
      expect(mockIns).toHaveBeenCalled();
      expect(res._id).toBe('nid');
      expect(res.name).toBe(input.name);
      expect(res.location).toEqual({ type: 'Point', coordinates: [10, 20] });
      expect(res.capacity).toEqual(input.capacity);
      expect(res.available).toEqual({ car: 1, bike: 2 });
      expect(res.operational_hours).toEqual(input.operational_hours);
      expect(res.facilities).toEqual(['f']);
      expect(res.images).toEqual(['i']);
      expect(res.status).toBe('inactive');
      expect(typeof res.created_at).toBe('string');
      expect(typeof res.updated_at).toBe('string');
    });
  });

  describe('findNearby', () => {
    it('builds default pipeline and returns results', async () => {
      const mockToArray = jest.fn().mockResolvedValue(['r']);
      const agg = jest.fn().mockReturnValue({ toArray: mockToArray });
      getDB.mockReturnValue({ collection: () => ({ aggregate: agg }) });
      const res = await Parking.findNearby({ longitude:1, latitude:2 });
      expect(agg).toHaveBeenCalled();
      expect(res).toEqual(['r']);
    });
    it('includes vehicleType filters and limit', async () => {
      const mockToArray = jest.fn().mockResolvedValue([]);
      const calls = [];
      const agg = jest.fn().mockImplementation(pipeline => {
        calls.push(pipeline);
        return { toArray: mockToArray };
      });
      getDB.mockReturnValue({ collection: () => ({ aggregate: agg }) });

      await Parking.findNearby({ longitude: 0, latitude: 0, maxDistance: 50, vehicleType: 'car', limit: 3 });

      const pipeline = calls[0];
      expect(pipeline).toEqual(expect.arrayContaining([
        expect.objectContaining({
          $geoNear: expect.objectContaining({
            near: { type: 'Point', coordinates: [0, 0] },
            maxDistance: 50,
            distanceField: 'distance',
            spherical: true
          })
        }),
        expect.objectContaining({ $match: { 'available.car': { $gt: 0 } } }),
        expect.objectContaining({ $limit: 3 })
      ]));
    });
  });

  describe('updateAvailability', () => {
    it('calls findOneAndUpdate and returns result', async () => {
      const mockUpd = jest.fn().mockResolvedValue('u');
      getDB.mockReturnValue({ collection: () => ({ findOneAndUpdate: mockUpd }) });
      const out = await Parking.updateAvailability('id', 'motorcycle', 2);
      expect(mockUpd).toHaveBeenCalled();
      expect(out).toBe('u');
    });
  });

  describe('findByOwner', () => {
    it('queries, sorts and maps fallback fields', async () => {
      const doc = { _id:'o', owner_id:'x', is_deleted:false };
      const mockToArray = jest.fn().mockResolvedValue([doc]);
      const mockFind = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnThis(), toArray: mockToArray });
      getDB.mockReturnValue({ collection: () => ({ find: mockFind }) });
      const res = await Parking.findByOwner('uid');
      expect(mockFind).toHaveBeenCalled();
      expect(res[0]).toHaveProperty('address', '');
      expect(res[0]).toHaveProperty('capacity');
      expect(res[0]).toHaveProperty('available');
      expect(res[0]).toHaveProperty('operational_hours');
    });
  });

  describe("createParking", () => {
    it("should throw an error if required fields are missing", async () => {
      const mockInput = { name: "Test Parking" }; // Missing required fields like location
      const mockCollection = { insertOne: jest.fn() };
      getDB.mockReturnValue({ collection: () => mockCollection });

      await expect(Parking.createParking(mockInput)).rejects.toThrow("Missing required fields");
    });

    it("should create a parking document successfully", async () => {
      const mockInput = {
        name: "Test Parking",
        location: { type: "Point", coordinates: [106.84513, -6.21462] },
        owner_id: "owner123",
      };
      const mockResult = { insertedId: "parking123" };
      const mockCollection = { insertOne: jest.fn().mockResolvedValue(mockResult) };
      getDB.mockReturnValue({ collection: () => mockCollection });

      const result = await Parking.createParking(mockInput);

      expect(result).toEqual({ id: "parking123" });
      expect(mockCollection.insertOne).toHaveBeenCalledWith(mockInput);
    });
  });

  describe("updateParking", () => {
    it("should throw an error if parking is not found", async () => {
      const mockCollection = { findOneAndUpdate: jest.fn().mockResolvedValue({ value: null }) };
      getDB.mockReturnValue({ collection: () => mockCollection });

      await expect(
        Parking.updateParking("nonexistentId", { name: "Updated Name" })
      ).rejects.toThrow("Parking not found");
    });

    it("should update a parking document successfully", async () => {
      const mockUpdate = { name: "Updated Name" };
      const mockResult = { value: { _id: "parking123", ...mockUpdate } };
      const mockCollection = { findOneAndUpdate: jest.fn().mockResolvedValue(mockResult) };
      getDB.mockReturnValue({ collection: () => mockCollection });

      const result = await Parking.updateParking("parking123", mockUpdate);

      expect(result).toEqual({ id: "parking123", ...mockUpdate });
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: "parking123" },
        { $set: mockUpdate },
        { returnDocument: "after" }
      );
    });
  });
});
