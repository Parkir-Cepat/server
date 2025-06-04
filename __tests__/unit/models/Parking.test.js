import { Parking } from "../../../models/Parking.js";
import { getDB } from "../../../config/db.js";
import { ObjectId } from "mongodb";
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock("../../../config/db.js");

describe("Parking Model", () => {
  let mockDb;
  let mockCollection;
  const mockUserId = new ObjectId();
  const mockParkingId = new ObjectId();
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: {
        port: 27017, // Use a specific port to avoid permission issues
      },
    });

    const mongoUri = mongoServer.getUri();
    process.env.MONGO_URI = mongoUri;
  });

  afterAll(async () => {
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(() => {
    mockCollection = {
      createIndex: jest.fn().mockResolvedValue(null),
      findOne: jest.fn(),
      find: jest.fn().mockReturnThis(),
      insertOne: jest.fn(),
      updateOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      sort: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
      aggregate: jest.fn().mockReturnThis()
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection)
    };

    getDB.mockReturnValue(mockDb);
  });

  describe("setupIndexes", () => {
    it("should create all indexes including text index", async () => {
      await Parking.setupIndexes();
      expect(mockDb.collection).toHaveBeenCalledWith(Parking.collection);
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ location: "2dsphere" });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ owner_id: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ created_at: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ name: "text", description: "text" });
      expect(mockCollection.createIndex).toHaveBeenCalledTimes(4);
    });
  });

  describe("findById", () => {
    it("should find parking by ID", async () => {
      const mockParking = {
        _id: mockParkingId,
        name: "Test Parking",
        available: {
          car: 5,
          motorcycle: 10
        }
      };

      mockCollection.findOne.mockResolvedValue(mockParking);

      const result = await Parking.findById(mockParkingId);

      expect(result).toEqual(mockParking);
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId)
      });
    });

    it("should set default available values if not provided", async () => {
      const mockParking = {
        _id: mockParkingId,
        name: "Test Parking"
      };

      mockCollection.findOne.mockResolvedValue(mockParking);

      const result = await Parking.findById(mockParkingId);

      expect(result.available).toEqual({
        car: 0,
        motorcycle: 0
      });
    });

    // New: when available provided, should preserve values
    it("should preserve provided available values", async () => {
      const provided = { car: 3, motorcycle: 4 };
      const mockParking = { _id: mockParkingId, name: "Test", available: provided };
      mockCollection.findOne.mockResolvedValue(mockParking);

      const result = await Parking.findById(mockParkingId);
      expect(result.available).toEqual(provided);
    });
  });

  describe("findById - not found case", () => {
    it("should return null if parking does not exist", async () => {
      mockCollection.findOne.mockResolvedValue(null);
      const result = await Parking.findById(mockParkingId);
      expect(result).toBeNull();
    });
  });

  describe("Parking Space Management", () => {
    describe("create", () => {
      const mockParkingData = {
        name: "Test Parking",
        address: "Test Address",
        owner_id: mockUserId.toString(),
        capacity: {
          car: 10,
          motorcycle: 20
        },
        rates: {
          car: 10000,
          motorcycle: 5000
        },
        location: {
          coordinates: [106.8456, -6.2088]
        }
      };

      it("should create parking with correct initial availability", async () => {
        mockCollection.insertOne.mockImplementation(data => ({
          insertedId: mockParkingId,
          acknowledged: true
        }));

        const result = await Parking.create(mockParkingData);

        expect(result).toEqual({
          _id: mockParkingId,
          ...mockParkingData,
          owner_id: expect.any(ObjectId),
          available: {
            car: 10,
            motorcycle: 20
          },
          location: {
            type: "Point",
            coordinates: mockParkingData.location.coordinates
          },
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        });
      });

      // New: preserve explicit available
      it("should not override provided available value", async () => {
        const dataWithAvail = { ...mockParkingData, available: { car: 7, motorcycle: 8 } };
        mockCollection.insertOne.mockImplementation(data => ({ insertedId: mockParkingId, acknowledged: true }));
        const result = await Parking.create(dataWithAvail);
        expect(result.available).toEqual({ car: 7, motorcycle: 8 });
      });
    });

    describe("create advanced", () => {
      it("should convert location to GeoJSON Point and set timestamps", async () => {
        const data = {
          name: "LocTest",
          owner_id: mockUserId.toString(),
          capacity: { car: 2, motorcycle: 3 },
          location: { coordinates: [1, 2] }
        };
        mockCollection.insertOne.mockResolvedValue({ insertedId: mockParkingId, acknowledged: true });
        const result = await Parking.create(data);
        expect(result.location).toEqual({ type: "Point", coordinates: [1, 2] });
        expect(result.created_at).toBeInstanceOf(Date);
        expect(result.updated_at).toBeInstanceOf(Date);
        expect(result.owner_id).toEqual(expect.any(ObjectId));
      });

      it("should not set available when capacity not provided", async () => {
        const dataNoCap = { name: "NoCap", owner_id: mockUserId.toString() };
        mockCollection.insertOne.mockResolvedValue({ insertedId: mockParkingId, acknowledged: true });
        const result = await Parking.create(dataNoCap);
        expect(result.available).toBeUndefined();
      });
    });

    describe("update", () => {
      const mockParking = {
        _id: mockParkingId,
        owner_id: mockUserId,
        name: "Test Parking",
        capacity: {
          car: 10,
          motorcycle: 20
        },
        available: {
          car: 8,
          motorcycle: 15
        },
        rates: {
          car: 10000,
          motorcycle: 5000
        }
      };

      it("should update parking details", async () => {
        const updatedParking = {
          ...mockParking,
          name: "Updated Parking",
          updated_at: new Date()
        };

        mockCollection.findOne
          .mockResolvedValueOnce(mockParking)  // First call for checking existence
          .mockResolvedValueOnce(updatedParking); // Second call after update

        const result = await Parking.update(mockParkingId, {
          name: "Updated Parking"
        });

        expect(result.name).toBe("Updated Parking");
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
          { _id: expect.any(ObjectId) },
          {
            $set: expect.objectContaining({
              name: "Updated Parking",
              updated_at: expect.any(Date)
            })
          }
        );
      });

      it("should return null if parking not found", async () => {
        mockCollection.findOne.mockResolvedValue(null);

        const result = await Parking.update(mockParkingId, { name: "New Name" });

        expect(result).toBeNull();
      });
    });
  });

  describe("Availability Management", () => {
    describe("updateAvailability", () => {
      it("should update available slots", async () => {
        const mockParking = {
          _id: mockParkingId,
          available: {
            car: 5,
            motorcycle: 10
          }
        };

        mockCollection.findOneAndUpdate.mockResolvedValue({
          ...mockParking,
          available: {
            car: 6,
            motorcycle: 10
          }
        });

        const result = await Parking.updateAvailability(mockParkingId, "car", 1);

        expect(result.available?.car).toBe(6);
      });

      // New: test for motorcycle branch
      it("should update available slots for motorcycle", async () => {
        const mockParking = { _id: mockParkingId, available: { car: 5, motorcycle: 10 } };
        mockCollection.findOneAndUpdate.mockResolvedValue({ ...mockParking, available: { car: 5, motorcycle: 11 } });
        const result = await Parking.updateAvailability(mockParkingId, "motorcycle", 1);
        expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
          { _id: expect.any(ObjectId) },
          { $inc: { available_slots: 1 } },
          { returnDocument: "after" }
        );
        expect(result.available.motorcycle).toBe(11);
      });

      it("should update available slots with negative change", async () => {
        const mockParking = { _id: mockParkingId, available: { car: 5, motorcycle: 10 } };
        mockCollection.findOneAndUpdate.mockResolvedValue({ ...mockParking, available: { car: 4, motorcycle: 10 } });
        const result = await Parking.updateAvailability(mockParkingId, "car", -1);
        expect(result.available.car).toBe(4);
      });
    });
  });

  describe("Search & Filters", () => {
    describe("findNearby", () => {
      it("should find nearby parkings", async () => {
        const mockParkings = [
          {
            _id: mockParkingId,
            name: "Test Parking",
            distance: 500
          }
        ];

        mockCollection.aggregate.mockReturnThis();
        mockCollection.toArray.mockResolvedValue(mockParkings);

        const result = await Parking.findNearby({
          longitude: 106.8,
          latitude: -6.2,
          maxDistance: 1000
        });

        expect(result).toEqual(mockParkings);
        expect(mockCollection.aggregate).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              $geoNear: expect.objectContaining({
                near: {
                  type: "Point",
                  coordinates: [106.8, -6.2]
                }
              })
            })
          ])
        );
      });

      // New: filter by car
      it("should filter results by vehicleType 'car'", async () => {
        mockCollection.aggregate.mockReturnThis();
        mockCollection.toArray.mockResolvedValue([{ _id: mockParkingId, name: "P1", distance: 100 }]);
        await Parking.findNearby({ longitude: 0, latitude: 0, vehicleType: 'car', limit: 5 });
        const pipeline = mockCollection.aggregate.mock.calls[0][0];
        expect(pipeline).toEqual(expect.arrayContaining([
          expect.objectContaining({ $match: { 'available.car': { $gt: 0 } } })
        ]));
      });

      // New: filter by motorcycle
      it("should filter results by vehicleType 'motorcycle'", async () => {
        mockCollection.aggregate.mockReturnThis();
        mockCollection.toArray.mockResolvedValue([{ _id: mockParkingId, name: "P2", distance: 200 }]);
        await Parking.findNearby({ longitude: 0, latitude: 0, vehicleType: 'motorcycle', limit: 3 });
        const pipeline = mockCollection.aggregate.mock.calls[0][0];
        expect(pipeline).toEqual(expect.arrayContaining([
          expect.objectContaining({ $match: { 'available.motorcycle': { $gt: 0 } } })
        ]));
      });

      // New: respects limit parameter
      it("should apply the limit parameter correctly", async () => {
        mockCollection.aggregate.mockReturnThis();
        mockCollection.toArray.mockResolvedValue([]);
        await Parking.findNearby({ longitude: 0, latitude: 0, limit: 2 });
        const pipeline = mockCollection.aggregate.mock.calls[0][0];
        expect(pipeline).toEqual(expect.arrayContaining([
          expect.objectContaining({ $limit: 2 })
        ]));
      });

      it("should use default maxDistance and limit, without vehicle filters", async () => {
        mockCollection.aggregate.mockReturnThis();
        mockCollection.toArray.mockResolvedValue([]);
        await Parking.findNearby({ longitude: 10, latitude: 20 });
        const pipeline = mockCollection.aggregate.mock.calls[0][0];
        // Should include $geoNear and initial $match plus $limit
        expect(pipeline[0]).toHaveProperty('$geoNear');
        expect(pipeline[1]).toHaveProperty('$match');
        expect(pipeline[pipeline.length-1]).toEqual({ $limit: 100 });
        // No vehicleType match stages
        expect(pipeline).not.toEqual(expect.arrayContaining([
          expect.objectContaining({ $match: { 'available.car': { $gt: 0 } } })
        ]));
      });
    });

    describe("findByOwner", () => {
      it("should find parkings by owner", async () => {
        const mockParkings = [
          {
            _id: mockParkingId,
            owner_id: mockUserId,
            name: "Test Parking"
          }
        ];

        mockCollection.find.mockReturnThis();
        mockCollection.toArray.mockResolvedValue(mockParkings);

        const result = await Parking.findByOwner(mockUserId);

        expect(result[0]).toEqual(expect.objectContaining({
          _id: mockParkingId,
          owner_id: mockUserId,
          name: "Test Parking",
          address: "",
          available: { car: 0, motorcycle: 0 },
          capacity: { car: 0, motorcycle: 0 },
          facilities: [],
          images: [],
          operational_hours: { open: "00:00", close: "23:59" },
          rating: 0,
          review_count: 0,
          status: "active"
        }));
      });

      it("should map fallback fields correctly", async () => {
        const incomplete = { _id: mockParkingId, owner_id: mockUserId };
        mockCollection.find.mockReturnThis();
        mockCollection.toArray.mockResolvedValue([incomplete]);
        const result = await Parking.findByOwner(mockUserId);
        expect(result).toHaveLength(1);
        const p = result[0];
        expect(p.address).toBe("");
        expect(p.capacity).toEqual({ car: 0, motorcycle: 0 });
        expect(p.available).toEqual({ car: 0, motorcycle: 0 });
        expect(p.facilities).toEqual([]);
        expect(p.images).toEqual([]);
        expect(p.operational_hours).toEqual({ open: "00:00", close: "23:59" });
        expect(p.rating).toBe(0);
        expect(p.review_count).toBe(0);
        expect(p.status).toBe("active");
      });

      it("should call correct query and sort by created_at descending", async () => {
        mockCollection.find.mockReturnThis();
        mockCollection.toArray.mockResolvedValue([]);
        const ownerStr = mockUserId.toString();
        const result = await Parking.findByOwner(ownerStr);
        expect(mockDb.collection).toHaveBeenCalledWith(Parking.collection);
        expect(mockCollection.find).toHaveBeenCalledWith({
          owner_id: expect.any(ObjectId),
          is_deleted: { $ne: true }
        });
        expect(mockCollection.sort).toHaveBeenCalledWith({ created_at: -1 });
        expect(result).toEqual([]);
      });
    });
  });
});
