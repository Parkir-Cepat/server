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
    it("should create the required indexes", async () => {
      await Parking.setupIndexes();

      expect(mockDb.collection).toHaveBeenCalledWith(Parking.collection);
      expect(mockCollection.createIndex).toHaveBeenCalledTimes(4);
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ location: "2dsphere" });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ owner_id: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ created_at: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ name: "text", description: "text" });
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
    });
  });
});
