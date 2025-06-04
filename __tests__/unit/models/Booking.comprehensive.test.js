// High-impact unit tests for Booking model - targeting 0.42% -> 85%+ coverage
import { Booking } from '../../../models/Booking.js';
import { getDB } from '../../../config/db.js';
import { ObjectId } from 'mongodb';

// Mock all dependencies
jest.mock('../../../config/db.js');
jest.mock('../../../helpers/qrcode.js');

describe('Booking Model - Comprehensive Coverage', () => {
  let mockDB, mockCollection;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCollection = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnThis(),
      insertOne: jest.fn(),
      updateOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      toArray: jest.fn()
    };

    mockDB = {
      collection: jest.fn().mockReturnValue(mockCollection),
      client: {
        startSession: jest.fn().mockReturnValue({
          withTransaction: jest.fn(),
          endSession: jest.fn()
        })
      }
    };

    getDB.mockReturnValue(mockDB);
  });

  // Test all static methods for maximum coverage
  describe('Static Methods Coverage', () => {
    const mockBookingId = new ObjectId();
    const mockUserId = new ObjectId();
    const mockParkingId = new ObjectId();

    it('should test findById method', async () => {
      const mockBooking = { _id: mockBookingId, status: 'pending' };
      mockCollection.findOne.mockResolvedValue(mockBooking);

      const result = await Booking.findById(mockBookingId);
      expect(result).toEqual(mockBooking);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: mockBookingId });
    });

    it('should test create method with all parameters', async () => {
      const bookingData = {
        user_id: mockUserId,
        parking_id: mockParkingId,
        vehicle_type: 'car',
        start_time: new Date(),
        duration: 2
      };

      // Mock parking lookup
      mockCollection.findOne.mockResolvedValueOnce({
        _id: mockParkingId,
        available: { car: 5 },
        capacity: { car: 10 },
        rates: { car: 10000 }
      });

      // Mock booking count check
      mockCollection.countDocuments.mockResolvedValue(3);

      // Mock insertion
      mockCollection.insertOne.mockResolvedValue({ insertedId: mockBookingId });

      const result = await Booking.create(bookingData);
      expect(result).toBeDefined();
      expect(mockCollection.insertOne).toHaveBeenCalled();
    });

    it('should test updateStatus method', async () => {
      const updatedBooking = { _id: mockBookingId, status: 'confirmed' };
      mockCollection.findOneAndUpdate.mockResolvedValue(updatedBooking);

      const result = await Booking.updateStatus(mockBookingId, 'confirmed');
      expect(result).toEqual(updatedBooking);
    });

    it('should test getActiveBookings method', async () => {
      const mockBookings = [{ _id: mockBookingId, status: 'active' }];
      mockCollection.toArray.mockResolvedValue(mockBookings);

      const result = await Booking.getActiveBookings(mockUserId);
      expect(result).toEqual(mockBookings);
      expect(mockCollection.find).toHaveBeenCalled();
    });

    it('should test getBookingHistory method', async () => {
      const mockBookings = [{ _id: mockBookingId, status: 'completed' }];
      mockCollection.toArray.mockResolvedValue(mockBookings);

      const result = await Booking.getBookingHistory(mockUserId);
      expect(result).toEqual(mockBookings);
    });

    it('should test getParkingBookings method', async () => {
      const mockResult = {
        bookings: [{ _id: mockBookingId }],
        total: 1,
        hasMore: false,
        stats: { active: 1, completed: 0 }
      };
      
      mockCollection.toArray
        .mockResolvedValueOnce([{ _id: mockBookingId }]) // bookings
        .mockResolvedValueOnce([{ _id: null, count: 1 }]) // count
        .mockResolvedValueOnce([{ _id: 'active', count: 1 }]); // stats

      const result = await Booking.getParkingBookings({
        parkingId: mockParkingId,
        status: 'active',
        limit: 10,
        offset: 0
      });

      expect(result.bookings).toBeDefined();
      expect(result.total).toBe(1);
    });

    it('should test processPayment method', async () => {
      const mockBooking = {
        _id: mockBookingId,
        user_id: mockUserId,
        parking_id: mockParkingId,
        vehicle_type: 'car',
        cost: 20000,
        status: 'pending'
      };

      const mockUser = { _id: mockUserId, saldo: 50000 };
      const mockParking = { _id: mockParkingId, available: { car: 5 } };

      mockCollection.findOne
        .mockResolvedValueOnce(mockBooking)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(mockParking)
        .mockResolvedValueOnce({ ...mockBooking, status: 'confirmed' });

      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const mockSession = {
        withTransaction: jest.fn().mockImplementation(async (callback) => {
          await callback();
          return true;
        }),
        endSession: jest.fn()
      };

      mockDB.client.startSession.mockReturnValue(mockSession);

      const result = await Booking.processPayment(mockBookingId, mockUserId);
      expect(result).toBeDefined();
      expect(mockSession.withTransaction).toHaveBeenCalled();
    });

    // Error handling scenarios
    it('should handle create with insufficient slots', async () => {
      const bookingData = {
        user_id: mockUserId,
        parking_id: mockParkingId,
        vehicle_type: 'car',
        start_time: new Date(),
        duration: 2
      };

      mockCollection.findOne.mockResolvedValue({
        _id: mockParkingId,
        available: { car: 0 },
        capacity: { car: 10 }
      });

      await expect(Booking.create(bookingData)).rejects.toThrow();
    });

    it('should handle processPayment with insufficient balance', async () => {
      const mockBooking = {
        _id: mockBookingId,
        user_id: mockUserId,
        cost: 50000,
        status: 'pending'
      };

      const mockUser = { _id: mockUserId, saldo: 10000 }; // Insufficient

      mockCollection.findOne
        .mockResolvedValueOnce(mockBooking)
        .mockResolvedValueOnce(mockUser);

      await expect(Booking.processPayment(mockBookingId, mockUserId))
        .rejects.toThrow(/Saldo tidak cukup/);
    });

    it('should handle booking not found scenarios', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      await expect(Booking.findById(mockBookingId)).resolves.toBeNull();
      await expect(Booking.processPayment(mockBookingId, mockUserId))
        .rejects.toThrow(/Booking tidak ditemukan/);
    });
  });

  // Test class constructor and instance methods
  describe('Instance Methods Coverage', () => {
    it('should test Booking class constructor', () => {
      const bookingData = {
        user_id: new ObjectId(),
        parking_id: new ObjectId(),
        vehicle_type: 'car',
        start_time: new Date(),
        duration: 2
      };

      const booking = new Booking(bookingData);
      expect(booking.user_id).toEqual(bookingData.user_id);
      expect(booking.vehicle_type).toBe('car');
    });
  });

  // Test validation methods
  describe('Validation Coverage', () => {
    it('should validate vehicle types', async () => {
      const invalidBookingData = {
        user_id: new ObjectId(),
        parking_id: new ObjectId(),
        vehicle_type: 'invalid_type',
        start_time: new Date(),
        duration: 2
      };

      // Mock parking data
      mockCollection.findOne.mockResolvedValue({
        _id: new ObjectId(),
        available: { car: 5 },
        capacity: { car: 10 },
        rates: { car: 10000 }
      });

      await expect(Booking.create(invalidBookingData)).rejects.toThrow();
    });

    it('should validate duration constraints', async () => {
      const invalidDurationData = {
        user_id: new ObjectId(),
        parking_id: new ObjectId(),
        vehicle_type: 'car',
        start_time: new Date(),
        duration: 0 // Invalid duration
      };

      await expect(Booking.create(invalidDurationData)).rejects.toThrow();
    });
  });
});
