import { bookingResolvers } from "../../../schemas/resolvers/bookingResolvers.js";
import { Booking } from "../../../models/Booking.js";
import { Parking } from "../../../models/Parking.js";
import { User } from "../../../models/User.js";
import { Transaction } from "../../../models/Transaction.js";
import { GraphQLError } from "graphql";
import { ObjectId } from "mongodb";
import { verifyQRToken } from "../../../helpers/qrcode.js";
import { getDB } from "../../../config/db.js";

// Mock dependencies
jest.mock("../../../models/Booking.js", () => ({
  Booking: {
    findById: jest.fn(),
    getActiveBookings: jest.fn(),
    getBookingHistory: jest.fn(),
    getParkingBookings: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock("../../../models/Parking.js", () => ({
  Parking: {
    findById: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock("../../../models/User.js");
jest.mock("../../../models/Transaction.js");
jest.mock("../../../helpers/qrcode.js");
jest.mock("../../../config/db.js");

describe("Booking Resolvers", () => {
  let mockContext;
  const mockUserId = new ObjectId();
  const mockParkingId = new ObjectId();
  const mockBookingId = new ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = {
      user: {
        _id: mockUserId,
        email: "test@example.com",
        role: "user"
      }
    };
  });

  describe("Query", () => {
    describe("getBooking", () => {
      it("should throw error if user is not authenticated", async () => {
        const mockContext = { user: null };
        
        await expect(bookingResolvers.Query.getBooking(null, { id: mockBookingId }, mockContext))
          .rejects
          .toThrow("Anda harus login terlebih dahulu");
      });

      it("should return booking data if found", async () => {
        const mockBooking = {
          _id: mockBookingId,
          user_id: mockUserId,
          parking_id: mockParkingId,
          status: "active"
        };

        Booking.findById.mockResolvedValue(mockBooking);

        const result = await bookingResolvers.Query.getBooking(
          null,
          { id: mockBookingId },
          mockContext
        );

        expect(result).toEqual(mockBooking);
        expect(Booking.findById).toHaveBeenCalledWith(mockBookingId);
      });
    });

    describe("getMyActiveBookings", () => {
      it("should throw error if user is not authenticated", async () => {
        const mockContext = { user: null };
        
        await expect(bookingResolvers.Query.getMyActiveBookings(null, {}, mockContext))
          .rejects
          .toThrow("Anda harus login terlebih dahulu");
      });

      it("should return active bookings for user", async () => {
        const mockBookings = [
          {
            _id: mockBookingId,
            user_id: mockUserId,
            parking_id: mockParkingId,
            status: "active"
          }
        ];

        Booking.getActiveBookings.mockResolvedValue(mockBookings);

        const result = await bookingResolvers.Query.getMyActiveBookings(
          null,
          {},
          mockContext
        );

        expect(result).toEqual(mockBookings);
        expect(Booking.getActiveBookings).toHaveBeenCalledWith(mockUserId);
      });
    });

    describe("getParkingBookings", () => {
      const mockArgs = {
        parkingId: mockParkingId,
        status: "active",
        limit: 10,
        offset: 0
      };

      it("should throw error if user is not authenticated", async () => {
        const mockContext = { user: null };
        
        await expect(bookingResolvers.Query.getParkingBookings(null, mockArgs, mockContext))
          .rejects
          .toThrow("Anda harus login terlebih dahulu");
      });

      it("should throw error if parking not found", async () => {
        Parking.findById.mockResolvedValue(null);

        await expect(bookingResolvers.Query.getParkingBookings(null, mockArgs, mockContext))
          .rejects
          .toThrow("Parking tidak ditemukan");
      });

      it("should throw error if user does not own the parking", async () => {
        const mockParking = {
          _id: mockParkingId,
          owner_id: new ObjectId(), // Different owner
          name: "Test Parking"
        };

        Parking.findById.mockResolvedValue(mockParking);

        await expect(bookingResolvers.Query.getParkingBookings(null, mockArgs, mockContext))
          .rejects
          .toThrow("Anda tidak memiliki akses ke parking ini");
      });

      it("should return parking bookings if user is owner", async () => {
        const mockParking = {
          _id: mockParkingId,
          owner_id: mockUserId,
          name: "Test Parking",
          address: "Test Address",
          rates: { car: 10000 },
          capacity: 100,
          available: 90,
          status: "active"
        };

        const mockBookingResult = {
          bookings: [
            {
              _id: mockBookingId,
              user_id: new ObjectId(),
              parking_id: mockParkingId,
              status: "active"
            }
          ],
          total: 1,
          hasMore: false,
          stats: {
            active: 1,
            completed: 0
          }
        };

        Parking.findById.mockResolvedValue(mockParking);
        Booking.getParkingBookings.mockResolvedValue(mockBookingResult);

        const result = await bookingResolvers.Query.getParkingBookings(
          null,
          mockArgs,
          mockContext
        );

        expect(result.bookings).toHaveLength(1);
        expect(result.total).toBe(1);
        expect(result.hasMore).toBe(false);
        expect(result.stats).toEqual(mockBookingResult.stats);
        expect(Booking.getParkingBookings).toHaveBeenCalledWith(mockArgs);
      });
    });
  });

  describe("Mutation", () => {
    describe("createBooking", () => {
      const mockInput = {
        parking_id: mockParkingId,
        vehicle_type: "car",
        start_time: "2024-03-20T10:00:00.000Z",
        duration: 2
      };

      it("should throw error if user is not authenticated", async () => {
        const mockContext = { user: null };
        
        await expect(bookingResolvers.Mutation.createBooking(null, { input: mockInput }, mockContext))
          .rejects
          .toThrow("Anda harus login terlebih dahulu");
      });

      it("should throw error if duration is less than 1 hour", async () => {
        const invalidInput = { ...mockInput, duration: 0 };

        await expect(bookingResolvers.Mutation.createBooking(null, { input: invalidInput }, mockContext))
          .rejects
          .toThrow("Durasi parkir minimal 1 jam");
      });

      it("should throw error if parking not found", async () => {
        Parking.findById.mockResolvedValue(null);

        await expect(bookingResolvers.Mutation.createBooking(null, { input: mockInput }, mockContext))
          .rejects
          .toThrow("Tempat parkir tidak ditemukan");
      });

      it("should create booking successfully", async () => {
        const mockParking = {
          _id: mockParkingId,
          name: "Test Parking",
          rates: { car: 10000 },
          available: 10
        };

        const mockBooking = {
          _id: mockBookingId,
          ...mockInput,
          user_id: mockUserId,
          total_price: 20000,
          status: "pending"
        };

        const expectedResponse = {
          booking: mockBooking,
          message: "Booking berhasil dibuat. Silakan lakukan pembayaran untuk konfirmasi.",
          qr_code: null,
          total_cost: 20000
        };

        Parking.findById.mockResolvedValue(mockParking);
        Booking.create.mockResolvedValue(mockBooking);

        const result = await bookingResolvers.Mutation.createBooking(
          null,
          { input: mockInput },
          mockContext
        );

        expect(result).toEqual(expectedResponse);
        expect(Booking.create).toHaveBeenCalled();
      });
    });
  });
}); 