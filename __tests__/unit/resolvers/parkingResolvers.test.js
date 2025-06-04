import { parkingResolvers } from "../../../schemas/resolvers/parkingResolvers.js";
import { Parking } from "../../../models/Parking.js";
import { User } from "../../../models/User.js";
import { getDB } from "../../../config/db.js";
import { GraphQLError } from "graphql";
import { ObjectId } from "mongodb";

// Mock dependencies
jest.mock("../../../models/Parking.js");
jest.mock("../../../models/User.js");
jest.mock("../../../config/db.js");
jest.mock("mongodb", () => ({
  ObjectId: jest.fn((id) => ({ toString: () => id, _id: id }))
}));

// Make ObjectId available globally for the production code
global.ObjectId = ObjectId;

describe("Parking Resolvers", () => {
  let mockContext;
  let mockDB;

  beforeEach(() => {
    jest.clearAllMocks();
      mockContext = {
      user: {
        _id: "user123",
        id: "user123", // Added for compatibility with resolver expectations
        email: "landowner@example.com",
        name: "Landowner User",
        role: "landowner"
      }
    };

    mockDB = {
      collection: jest.fn().mockReturnValue({
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              toArray: jest.fn().mockResolvedValue([])
            })
          }),
          toArray: jest.fn().mockResolvedValue([])
        }),
        findOne: jest.fn().mockResolvedValue(null),
        findOneAndUpdate: jest.fn().mockResolvedValue({ value: null }),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        insertOne: jest.fn().mockResolvedValue({ insertedId: "parking123" }),
        aggregate: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        })
      })
    };

    getDB.mockReturnValue(mockDB);
  });

  describe("Query Resolvers", () => {
    describe("getOwnerStats", () => {
      it("should return owner statistics for authenticated user", async () => {
        const mockStats = {
          totalBalance: 1000000,
          currentBalance: 1000000,
          totalIncome: 500000,
          totalBookings: 25,
          averageRating: 4.5
        };

        Parking.getOwnerStats.mockResolvedValue(mockStats);

        const result = await parkingResolvers.Query.getOwnerStats(null, {}, mockContext);

        expect(Parking.getOwnerStats).toHaveBeenCalledWith("user123");
        expect(result).toEqual(mockStats);
      });

      it("should throw authentication error when user not provided", async () => {
        const contextWithoutUser = { user: null };

        await expect(
          parkingResolvers.Query.getOwnerStats(null, {}, contextWithoutUser)
        ).rejects.toThrow(GraphQLError);
      });
    });

    describe("getParkingStats", () => {
      it("should return parking statistics for parking owner", async () => {
        const parkingId = "parking123";
        const mockParking = {
          _id: parkingId,
          name: "Test Parking",
          owner_id: "user123"
        };

        const mockStats = {
          parkingId,
          parkingName: "Test Parking",
          totalRevenue: 250000,
          totalBookings: 15,
          averageRating: 4.2,
          currentOccupancyRate: 65.5,
          dailyStats: [],
          monthlyStats: [],
          vehicleDistribution: { car: 8, motorcycle: 7 }
        };

        Parking.findById.mockResolvedValue(mockParking);
        Parking.getParkingStats.mockResolvedValue(mockStats);

        const result = await parkingResolvers.Query.getParkingStats(
          null, 
          { parkingId }, 
          mockContext
        );

        expect(Parking.findById).toHaveBeenCalledWith(parkingId);
        expect(Parking.getParkingStats).toHaveBeenCalledWith(parkingId);
        expect(result).toEqual(mockStats);
      });

      it("should throw forbidden error when user doesn't own parking", async () => {
        const parkingId = "parking123";
        const mockParking = {
          _id: parkingId,
          name: "Test Parking",
          owner_id: "otheruser456"
        };

        Parking.findById.mockResolvedValue(mockParking);

        await expect(
          parkingResolvers.Query.getParkingStats(null, { parkingId }, mockContext)
        ).rejects.toThrow(GraphQLError);
      });

      it("should throw authentication error when user not provided", async () => {
        const contextWithoutUser = { user: null };

        await expect(
          parkingResolvers.Query.getParkingStats(null, { parkingId: "parking123" }, contextWithoutUser)
        ).rejects.toThrow(GraphQLError);
      });
    });

    describe("getParking", () => {
      it("should return parking by ID", async () => {
        const parkingId = "parking123";
        const mockParking = {
          _id: parkingId,
          name: "Test Parking",
          address: "Test Address",
          capacity: { car: 10, motorcycle: 20 },
          available: { car: 5, motorcycle: 15 }
        };

        Parking.findById.mockResolvedValue(mockParking);

        const result = await parkingResolvers.Query.getParking(null, { id: parkingId }, {});

        expect(Parking.findById).toHaveBeenCalledWith(parkingId);
        expect(result).toEqual(mockParking);
      });

      it("should throw error when parking not found", async () => {
        const parkingId = "nonexistent";
        Parking.findById.mockResolvedValue(null);

        await expect(
          parkingResolvers.Query.getParking(null, { id: parkingId }, {})
        ).rejects.toThrow("Tempat parkir tidak ditemukan");
      });
    });

    describe("getNearbyParkings", () => {
      it("should return nearby parkings with default parameters", async () => {
        const mockParkings = [
          {
            _id: "parking1",
            name: "Nearby Parking 1",
            location: { coordinates: [106.845, -6.208] },
            available: { car: 5, motorcycle: 10 }
          },
          {
            _id: "parking2", 
            name: "Nearby Parking 2",
            location: { coordinates: [106.847, -6.210] },
            available: { car: 3, motorcycle: 8 }
          }
        ];

        Parking.findNearby.mockResolvedValue(mockParkings);

        const result = await parkingResolvers.Query.getNearbyParkings(
          null,
          { longitude: 106.846, latitude: -6.209 },
          {}
        );

        expect(Parking.findNearby).toHaveBeenCalledWith({
          longitude: 106.846,
          latitude: -6.209,
          maxDistance: 50000,
          limit: 20,
          vehicleType: undefined
        });
        expect(result).toEqual(mockParkings);
      });

      it("should return nearby parkings with custom parameters", async () => {
        const mockParkings = [
          {
            _id: "parking1",
            name: "Car Parking",
            available: { car: 5, motorcycle: 0 }
          }
        ];

        Parking.findNearby.mockResolvedValue(mockParkings);

        const result = await parkingResolvers.Query.getNearbyParkings(
          null,
          { 
            longitude: 106.846, 
            latitude: -6.209,
            maxDistance: 10000,
            limit: 5,
            vehicleType: "car"
          },
          {}
        );

        expect(Parking.findNearby).toHaveBeenCalledWith({
          longitude: 106.846,
          latitude: -6.209,
          maxDistance: 10000,
          limit: 5,
          vehicleType: "car"
        });
        expect(result).toEqual(mockParkings);
      });

      it("should handle errors from findNearby", async () => {
        Parking.findNearby.mockRejectedValue(new Error("Database error"));

        await expect(
          parkingResolvers.Query.getNearbyParkings(
            null,
            { longitude: 106.846, latitude: -6.209 },
            {}
          )
        ).rejects.toThrow(GraphQLError);
      });
    });

    describe("getMyParkings", () => {
      it("should return user's parkings for landowner", async () => {        const mockParkings = [
          {
            _id: "parking1",
            name: "My Parking 1",
            address: "Address 1",
            capacity: { car: 10, motorcycle: 20 },
            available: { car: 5, motorcycle: 15 },
            rates: { car: 5000, motorcycle: 2000 },
            operational_hours: { open: "06:00", close: "22:00" },
            facilities: [],
            images: [],
            status: "active",
            rating: 4.5,
            review_count: 12,
            created_at: new Date(),
            updated_at: new Date()
          },
          {
            _id: "parking2",
            name: "My Parking 2", 
            address: "Address 2",
            capacity: { car: 15, motorcycle: 25 },
            available: { car: 8, motorcycle: 18 },
            rates: { car: 6000, motorcycle: 2500 },
            operational_hours: { open: "07:00", close: "23:00" },
            facilities: [],
            images: [],
            status: "active",
            rating: 4.2,
            review_count: 8,
            created_at: new Date(),
            updated_at: new Date()
          }
        ];

        Parking.findByOwner.mockResolvedValue(mockParkings);

        const result = await parkingResolvers.Query.getMyParkings(null, {}, mockContext);

        expect(Parking.findByOwner).toHaveBeenCalledWith("user123");
        expect(result).toEqual(mockParkings);
      });

      it("should throw authentication error when user not provided", async () => {
        const contextWithoutUser = { user: null };

        await expect(
          parkingResolvers.Query.getMyParkings(null, {}, contextWithoutUser)
        ).rejects.toThrow(GraphQLError);
      });

      it("should throw forbidden error when user is not landowner", async () => {
        const userContext = {
          user: { ...mockContext.user, role: "user" }
        };

        await expect(
          parkingResolvers.Query.getMyParkings(null, {}, userContext)
        ).rejects.toThrow(GraphQLError);
      });

      it("should filter out invalid parking data", async () => {        const mockParkings = [
          {
            _id: "parking1",
            name: "Valid Parking",
            address: "Valid Address",
            capacity: { car: 10, motorcycle: 20 },
            available: { car: 5, motorcycle: 15 },
            rates: { car: 5000, motorcycle: 2000 },
            operational_hours: { open: "06:00", close: "22:00" },
            facilities: [],
            images: [],
            status: "active"
          },
          {
            _id: "parking2",
            name: null, // Invalid - missing name
            address: "Address",
            capacity: { car: 10, motorcycle: 20 }
          },
          {
            _id: "parking3",
            name: "Another Valid",
            address: null, // Invalid - missing address
            capacity: { car: 10, motorcycle: 20 }
          }
        ];

        Parking.findByOwner.mockResolvedValue(mockParkings);

        const result = await parkingResolvers.Query.getMyParkings(null, {}, mockContext);

        // Should only return the first valid parking
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("Valid Parking");
      });
    });

    describe("searchParkings", () => {
      it("should search parkings by query", async () => {
        const mockParkings = [
          {
            _id: "parking1",
            name: "Central Mall Parking",
            description: "Secure parking in city center"
          },
          {
            _id: "parking2",
            name: "Plaza Central Garage",
            description: "Affordable parking rates"
          }
        ];

        mockDB.collection().find.mockReturnValue({
          limit: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue(mockParkings)
          })
        });

        const result = await parkingResolvers.Query.searchParkings(
          null,
          { query: "central", limit: 20 },
          {}
        );

        expect(result).toEqual(mockParkings);
      });

      it("should use default limit when not provided", async () => {
        const mockParkings = [];

        mockDB.collection().find.mockReturnValue({
          limit: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue(mockParkings)
          })
        });

        const result = await parkingResolvers.Query.searchParkings(
          null,
          { query: "parking" },
          {}
        );

        expect(mockDB.collection().find().limit).toHaveBeenCalledWith(20);
        expect(result).toEqual(mockParkings);
      });
    });
  });

  describe("Mutation Resolvers", () => {
    describe("createParking", () => {
      it("should create new parking successfully", async () => {
        const input = {
          name: "New Parking",
          address: "New Address",
          location: {
            coordinates: [106.845, -6.208]
          },
          capacity: { car: 20, motorcycle: 30 },
          rates: { car: 5000, motorcycle: 3000 },
          operational_hours: { open: "06:00", close: "22:00" },
          facilities: ["Security", "CCTV"],
          images: ["image1.jpg", "image2.jpg"]
        };

        const mockCreatedParking = {
          _id: "parking123",
          ...input,
          owner_id: "user123",
          available: { car: 20, motorcycle: 30 },
          rating: 0,
          review_count: 0,
          status: "active",
          created_at: new Date(),
          updated_at: new Date()
        };

        Parking.create.mockResolvedValue(mockCreatedParking);

        const result = await parkingResolvers.Mutation.createParking(
          null,
          { input },
          mockContext
        );

        expect(Parking.create).toHaveBeenCalledWith({
          ...input,
          location: {
            type: "Point",
            coordinates: input.location.coordinates
          },
          owner_id: "user123",
          available: {
            car: input.capacity.car,
            motorcycle: input.capacity.motorcycle
          },
          rating: 0,
          review_count: 0,
          status: "active"
        });
        expect(result).toEqual(mockCreatedParking);
      });

      it("should throw authentication error when user not provided", async () => {
        const contextWithoutUser = { user: null };

        await expect(
          parkingResolvers.Mutation.createParking(
            null,
            { input: {} },
            contextWithoutUser
          )
        ).rejects.toThrow(GraphQLError);
      });

      it("should handle creation errors", async () => {
        const input = {
          name: "New Parking",
          address: "New Address",
          capacity: { car: 20, motorcycle: 30 }
        };

        Parking.create.mockRejectedValue(new Error("Validation failed"));

        await expect(
          parkingResolvers.Mutation.createParking(null, { input }, mockContext)
        ).rejects.toThrow("Gagal membuat parking: Validation failed");
      });
    });

    describe("updateParking", () => {
      it("should update parking successfully", async () => {
        const parkingId = "parking123";
        const input = {
          name: "Updated Parking",
          rates: { car: 6000, motorcycle: 4000 }
        };

        const mockExistingParking = {
          _id: parkingId,
          name: "Old Parking",
          owner_id: "user123",
          rates: { car: 5000, motorcycle: 3000 }
        };

        const mockUpdatedParking = {
          ...mockExistingParking,
          ...input,
          updated_at: new Date()
        };

        Parking.findById.mockResolvedValue(mockExistingParking);
        Parking.update.mockResolvedValue(mockUpdatedParking);

        const result = await parkingResolvers.Mutation.updateParking(
          null,
          { id: parkingId, input },
          mockContext
        );

        expect(Parking.findById).toHaveBeenCalledWith(parkingId);
        expect(Parking.update).toHaveBeenCalledWith(parkingId, input);
        expect(result).toEqual(mockUpdatedParking);
      });

      it("should throw authentication error when user not provided", async () => {
        const contextWithoutUser = { user: null };

        await expect(
          parkingResolvers.Mutation.updateParking(
            null,
            { id: "parking123", input: {} },
            contextWithoutUser
          )
        ).rejects.toThrow(GraphQLError);
      });

      it("should throw error when parking not found", async () => {
        const parkingId = "nonexistent";
        Parking.findById.mockResolvedValue(null);

        await expect(
          parkingResolvers.Mutation.updateParking(
            null,
            { id: parkingId, input: {} },
            mockContext
          )
        ).rejects.toThrow("Tempat parkir tidak ditemukan");
      });

      it("should throw forbidden error when user doesn't own parking", async () => {
        const parkingId = "parking123";
        const mockParking = {
          _id: parkingId,
          owner_id: "otheruser456"
        };

        Parking.findById.mockResolvedValue(mockParking);

        await expect(
          parkingResolvers.Mutation.updateParking(
            null,
            { id: parkingId, input: {} },
            mockContext
          )
        ).rejects.toThrow(GraphQLError);
      });

      it("should allow admin to update any parking", async () => {
        const adminContext = {
          user: { ...mockContext.user, role: "admin" }
        };

        const parkingId = "parking123";
        const input = { name: "Admin Updated" };

        const mockParking = {
          _id: parkingId,
          owner_id: "otheruser456"
        };

        const mockUpdatedParking = {
          ...mockParking,
          ...input
        };

        Parking.findById.mockResolvedValue(mockParking);
        Parking.update.mockResolvedValue(mockUpdatedParking);

        const result = await parkingResolvers.Mutation.updateParking(
          null,
          { id: parkingId, input },
          adminContext
        );

        expect(result).toEqual(mockUpdatedParking);
      });
    });

    describe("deleteParking", () => {      it("should delete parking successfully", async () => {
        const parkingId = "parking123";
        const mockParking = {
          _id: parkingId,
          name: "Parking to Delete",
          owner_id: "user123"
        };

        Parking.findById.mockResolvedValue(mockParking);
        Parking.delete.mockResolvedValue(true);

        const result = await parkingResolvers.Mutation.deleteParking(
          null,
          { id: parkingId },
          mockContext
        );

        expect(Parking.findById).toHaveBeenCalledWith(parkingId);
        expect(Parking.delete).toHaveBeenCalledWith(parkingId);
        expect(result).toBe(true);
      });

      it("should throw authentication error when user not provided", async () => {
        const contextWithoutUser = { user: null };

        await expect(
          parkingResolvers.Mutation.deleteParking(
            null,
            { id: "parking123" },
            contextWithoutUser
          )
        ).rejects.toThrow(GraphQLError);
      });

      it("should throw error when parking not found", async () => {
        const parkingId = "nonexistent";
        Parking.findById.mockResolvedValue(null);

        await expect(
          parkingResolvers.Mutation.deleteParking(
            null,
            { id: parkingId },
            mockContext
          )
        ).rejects.toThrow("Tempat parkir tidak ditemukan");
      });

      it("should throw forbidden error when user doesn't own parking", async () => {
        const parkingId = "parking123";
        const mockParking = {
          _id: parkingId,
          owner_id: "otheruser456"
        };

        Parking.findById.mockResolvedValue(mockParking);

        await expect(
          parkingResolvers.Mutation.deleteParking(
            null,
            { id: parkingId },
            mockContext
          )
        ).rejects.toThrow(GraphQLError);
      });
    });

    describe("fixParkingAvailability", () => {
      it("should fix parking availability successfully", async () => {
        const parkingId = "parking123";
        const mockParking = {
          _id: parkingId,
          owner_id: "user123",
          capacity: { car: 10, motorcycle: 20 }
        };

        const mockActiveBookings = [
          { _id: "car", count: 3 },
          { _id: "motorcycle", count: 5 }
        ];

        const mockUpdatedParking = {
          ...mockParking,
          available: { car: 7, motorcycle: 15 }
        };

        mockDB.collection().findOne.mockResolvedValue(mockParking);
        mockDB.collection().aggregate.mockReturnValue({
          toArray: jest.fn().mockResolvedValue(mockActiveBookings)
        });
        mockDB.collection().findOneAndUpdate.mockResolvedValue({
          value: mockUpdatedParking
        });        const result = await parkingResolvers.Mutation.fixParkingAvailability(
          null,
          { parking_id: parkingId },
          mockContext
        );

        expect(result).toEqual({
          value: mockUpdatedParking
        });
      });

      it("should throw authentication error when user not provided", async () => {
        const contextWithoutUser = { user: null };

        await expect(
          parkingResolvers.Mutation.fixParkingAvailability(
            null,
            { parking_id: "parking123" },
            contextWithoutUser
          )
        ).rejects.toThrow(GraphQLError);
      });

      it("should throw error when parking not found", async () => {
        mockDB.collection().findOne.mockResolvedValue(null);

        await expect(
          parkingResolvers.Mutation.fixParkingAvailability(
            null,
            { parking_id: "nonexistent" },
            mockContext
          )
        ).rejects.toThrow("Parking tidak ditemukan");
      });

      it("should throw error when user doesn't have access", async () => {
        const mockParking = {
          _id: "parking123",
          owner_id: "otheruser456"
        };

        mockDB.collection().findOne.mockResolvedValue(mockParking);

        await expect(
          parkingResolvers.Mutation.fixParkingAvailability(
            null,
            { parking_id: "parking123" },
            mockContext
          )
        ).rejects.toThrow("Tidak memiliki akses");
      });

      it("should allow admin to fix any parking availability", async () => {
        const adminContext = {
          user: { ...mockContext.user, role: "admin" }
        };

        const parkingId = "parking123";
        const mockParking = {
          _id: parkingId,
          owner_id: "otheruser456",
          capacity: { car: 10, motorcycle: 20 }
        };

        const mockUpdatedParking = {
          ...mockParking,
          available: { car: 10, motorcycle: 20 }
        };

        mockDB.collection().findOne.mockResolvedValue(mockParking);
        mockDB.collection().aggregate.mockReturnValue({
          toArray: jest.fn().mockResolvedValue([])
        });
        mockDB.collection().findOneAndUpdate.mockResolvedValue({
          value: mockUpdatedParking
        });        const result = await parkingResolvers.Mutation.fixParkingAvailability(
          null,
          { parking_id: parkingId },
          adminContext
        );

        expect(result).toEqual({
          value: mockUpdatedParking
        });
      });
    });
  });

  describe("Parking Type Resolver", () => {
    describe("owner", () => {
      it("should resolve parking owner", async () => {
        const mockParking = {
          _id: "parking123",
          owner_id: "user456"
        };

        const mockOwner = {
          _id: "user456",
          name: "Owner User",
          email: "owner@example.com"
        };

        User.findById.mockResolvedValue(mockOwner);

        const result = await parkingResolvers.Parking.owner(mockParking);

        expect(User.findById).toHaveBeenCalledWith("user456");
        expect(result).toEqual(mockOwner);
      });
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle database errors gracefully in getNearbyParkings", async () => {
      Parking.findNearby.mockRejectedValue(new Error("Connection timeout"));

      await expect(
        parkingResolvers.Query.getNearbyParkings(
          null,
          { longitude: 106.846, latitude: -6.209 },
          {}
        )
      ).rejects.toThrow(GraphQLError);
    });

    it("should handle null location in createParking", async () => {
      const input = {
        name: "Test Parking",
        address: "Test Address",
        capacity: { car: 10, motorcycle: 20 },
        location: null
      };

      const mockCreatedParking = {
        _id: "parking123",
        ...input,
        location: null,
        owner_id: "user123"
      };

      Parking.create.mockResolvedValue(mockCreatedParking);

      const result = await parkingResolvers.Mutation.createParking(
        null,
        { input },
        mockContext
      );

      expect(result).toEqual(mockCreatedParking);
    });

    it("should handle failed update in updateParking", async () => {
      const parkingId = "parking123";
      const mockParking = {
        _id: parkingId,
        owner_id: "user123"
      };

      Parking.findById.mockResolvedValue(mockParking);
      Parking.update.mockResolvedValue(null);

      await expect(
        parkingResolvers.Mutation.updateParking(
          null,
          { id: parkingId, input: {} },
          mockContext
        )
      ).rejects.toThrow(GraphQLError);
    });

    it("should handle aggregation errors in fixParkingAvailability", async () => {
      const parkingId = "parking123";
      const mockParking = {
        _id: parkingId,
        owner_id: "user123",
        capacity: { car: 10, motorcycle: 20 }
      };

      mockDB.collection().findOne.mockResolvedValue(mockParking);
      mockDB.collection().aggregate.mockReturnValue({
        toArray: jest.fn().mockRejectedValue(new Error("Aggregation failed"))
      });

      await expect(
        parkingResolvers.Mutation.fixParkingAvailability(
          null,
          { parking_id: parkingId },
          mockContext
        )
      ).rejects.toThrow("Aggregation failed");
    });
  });
});
