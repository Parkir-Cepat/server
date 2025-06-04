import { Booking } from '../../../models/Booking.js';
import { getDB } from '../../../config/db.js';
import { ObjectId } from 'mongodb';

// Mock dependencies
jest.mock('../../../config/db.js');
jest.mock('../../../helpers/qrcode.js');

describe('Booking Model', () => {
  let mockDB;
  let mockCollection;
  let mockSession;
  const mockUserId = new ObjectId();
  const mockParkingId = new ObjectId();
  const mockBookingId = new ObjectId();

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
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      aggregate: jest.fn().mockReturnThis()
    };

    mockSession = {
      withTransaction: jest.fn(callback => callback()),
      endSession: jest.fn()
    };

    mockDB = {
      collection: jest.fn().mockReturnValue(mockCollection),
      startSession: jest.fn().mockReturnValue(mockSession),
      client: {
        startSession: jest.fn().mockReturnValue(mockSession)
      }
    };

    getDB.mockReturnValue(mockDB);
    jest.clearAllMocks();
  });

  describe('setupIndexes', () => {
    it('should create all required indexes', async () => {
      await Booking.setupIndexes();

      expect(mockCollection.createIndex).toHaveBeenCalledTimes(5);
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ user_id: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ parking_id: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ status: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ start_time: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ created_at: 1 });
    });
  });

  describe('findById', () => {
    it('should find booking by id', async () => {
      const mockBooking = { _id: mockBookingId, user_id: mockUserId };
      mockCollection.findOne.mockResolvedValue(mockBooking);

      const result = await Booking.findById(mockBookingId.toString());

      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: mockBookingId });
      expect(result).toEqual(mockBooking);
    });

    it('should return null if booking not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await Booking.findById(mockBookingId.toString());

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    const mockBookingData = {
      user_id: mockUserId,
      parking_id: mockParkingId,
      vehicle_type: 'car',
      start_time: new Date(),
      duration: 2
    };

    const mockParking = {
      _id: mockParkingId,
      available: { car: 5, motorcycle: 10 },
      capacity: { car: 10, motorcycle: 20 },
      rates: { car: 5000, motorcycle: 2000 }
    };

    beforeEach(() => {
      mockCollection.findOne.mockResolvedValue(mockParking);
      mockCollection.countDocuments.mockResolvedValue(2);
      mockCollection.insertOne.mockResolvedValue({ insertedId: mockBookingId });
    });

    it('should create booking successfully', async () => {
      const result = await Booking.create(mockBookingData);

      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: mockParkingId });
      expect(mockCollection.countDocuments).toHaveBeenCalled();
      expect(mockCollection.insertOne).toHaveBeenCalled();
      expect(result._id).toEqual(mockBookingId);
      expect(result.status).toBe('pending');
      expect(result.cost).toBe(10000); // 5000 * 2 hours
    });

    it('should throw error if parking not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      await expect(Booking.create(mockBookingData)).rejects.toThrow('Tempat parkir tidak ditemukan');
    });

    it('should throw error if no available slots', async () => {
      mockCollection.findOne.mockResolvedValue({
        ...mockParking,
        available: { car: 0, motorcycle: 10 }
      });

      await expect(Booking.create(mockBookingData)).rejects.toThrow('Slot parkir car tidak tersedia');
    });

    it('should throw error if no price for vehicle type', async () => {
      mockCollection.findOne.mockResolvedValue({
        ...mockParking,
        rates: { motorcycle: 2000 } // No car rate
      });

      await expect(Booking.create(mockBookingData)).rejects.toThrow('Harga untuk car tidak tersedia');
    });

    it('should throw error if parking is full', async () => {
      mockCollection.countDocuments.mockResolvedValue(10); // Full capacity

      await expect(Booking.create(mockBookingData)).rejects.toThrow('Slot parkir car sudah penuh');
    });
  });

  describe('processPayment', () => {
    const mockBooking = {
      _id: mockBookingId,
      user_id: mockUserId,
      parking_id: mockParkingId,
      vehicle_type: 'car',
      status: 'pending',
      cost: 10000
    };

    const mockUser = {
      _id: mockUserId,
      saldo: 50000
    };

    const mockParking = {
      _id: mockParkingId,
      available: { car: 5 }
    };

    beforeEach(() => {
      mockCollection.findOne
        .mockImplementation((query) => {
          if (query._id?.toString() === mockBookingId.toString()) {
            return mockBooking;
          } else if (query._id?.toString() === mockUserId.toString()) {
            return mockUser;
          } else if (query._id?.toString() === mockParkingId.toString()) {
            return mockParking;
          }
          return null;
        });

      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
      mockCollection.findOneAndUpdate.mockResolvedValue({ value: { ...mockBooking, status: 'cancelled' } });
    });

    it('should process payment successfully', async () => {
      const result = await Booking.processPayment(mockBookingId.toString(), mockUserId.toString());

      expect(mockSession.withTransaction).toHaveBeenCalled();
      expect(mockCollection.updateOne).toHaveBeenCalledTimes(3); // user, parking, booking updates
      expect(result).toBeDefined();
    });

    it('should throw error if booking not found', async () => {
      mockCollection.findOne.mockImplementationOnce((query) => {
        if (query._id.toString() === mockBookingId.toString()) {
          return null; // Simulate booking not found
        }
        return mockBooking;
      });

      await expect(Booking.processPayment(mockBookingId.toString(), mockUserId.toString()))
        .rejects.toThrow('Booking tidak ditemukan');
    });

    it('should throw error if user is not booking owner', async () => {
      const otherUserId = new ObjectId();
      mockCollection.findOne.mockResolvedValueOnce(mockBooking);

      await expect(Booking.processPayment(mockBookingId.toString(), otherUserId.toString()))
        .rejects.toThrow('Unauthorized - booking tidak milik user ini');
    });

    it('should throw error if booking is not pending', async () => {
      mockCollection.findOne.mockResolvedValueOnce({ ...mockBooking, status: 'confirmed' });

      await expect(Booking.processPayment(mockBookingId.toString(), mockUserId.toString()))
        .rejects.toThrow('Booking sudah dibayar atau dibatalkan');
    });

    it('should throw error if user not found', async () => {
      mockCollection.findOne.mockResolvedValueOnce(mockBooking) // Booking found
        .mockResolvedValueOnce(null); // User not found

      await expect(Booking.processPayment(mockBookingId.toString(), mockUserId.toString()))
        .rejects.toThrow('User tidak ditemukan');
    });

    it('should throw error if user has insufficient balance', async () => {
      mockCollection.findOne.mockResolvedValueOnce(mockBooking) // Booking found
        .mockResolvedValueOnce({ ...mockUser, saldo: 5000 }); // Insufficient balance

      await expect(Booking.processPayment(mockBookingId.toString(), mockUserId.toString()))
        .rejects.toThrow('Saldo tidak cukup. Saldo: Rp 5,000, Dibutuhkan: Rp 10,000');
    });

    it('should throw error if parking slot is unavailable', async () => {
      mockCollection.findOne.mockResolvedValueOnce(mockBooking) // Booking found
        .mockResolvedValueOnce(mockUser) // User found
        .mockResolvedValueOnce({ ...mockParking, available: { car: 0 } }); // No available slots

      await expect(Booking.processPayment(mockBookingId.toString(), mockUserId.toString()))
        .rejects.toThrow('Slot parkir car sudah tidak tersedia');
    });
  });

  describe('getActiveBookings', () => {
    it('should get active bookings for user', async () => {
      const mockBookings = [
        { _id: mockBookingId, user_id: mockUserId, status: 'confirmed' }
      ];
      mockCollection.toArray.mockResolvedValue(mockBookings);

      const result = await Booking.getActiveBookings(mockUserId.toString());

      expect(mockCollection.find).toHaveBeenCalledWith({
        user_id: mockUserId,
        status: { $in: ['pending', 'confirmed', 'active', 'completed'] }
      });
      expect(result).toEqual(mockBookings);
    });
  });

  describe('getCurrentActiveBookings', () => {
    it('should get current active bookings for user', async () => {
      const mockBookings = [
        { _id: mockBookingId, user_id: mockUserId, status: 'active' }
      ];
      mockCollection.toArray.mockResolvedValue(mockBookings);

      const result = await Booking.getCurrentActiveBookings(mockUserId.toString());

      expect(mockCollection.find).toHaveBeenCalledWith({
        user_id: mockUserId,
        status: { $in: ['confirmed', 'active'] }
      });
      expect(result).toEqual(mockBookings);
    });
  });

  describe('getAllUserBookings', () => {
    it('should get all user bookings', async () => {
      const mockBookings = [
        { _id: mockBookingId, user_id: mockUserId, status: 'completed' }
      ];
      mockCollection.toArray.mockResolvedValue(mockBookings);

      const result = await Booking.getAllUserBookings(mockUserId.toString());

      expect(mockCollection.find).toHaveBeenCalledWith({
        user_id: mockUserId
      });
      expect(result).toEqual(mockBookings);
    });
  });

  describe('getParkingBookings', () => {
    const filters = {
      parkingId: mockParkingId.toString(),
      status: 'confirmed',
      limit: 10,
      offset: 0
    };

    beforeEach(() => {
      mockCollection.countDocuments.mockResolvedValue(5);
      mockCollection.toArray.mockResolvedValue([
        { _id: mockBookingId, user_id: mockUserId, parking_id: mockParkingId }
      ]);
    });

    it('should get parking bookings with filters', async () => {
      const result = await Booking.getParkingBookings(filters);

      expect(mockCollection.countDocuments).toHaveBeenCalled();
      expect(mockCollection.find).toHaveBeenCalledWith({
        parking_id: mockParkingId,
        status: 'confirmed'
      });
      expect(result.total).toBe(5);
      expect(result.bookings).toHaveLength(1);
    });

    it('should handle date range filters', async () => {
      const filtersWithDates = {
        ...filters,
        startDate: '2024-01-01',
        endDate: '2024-12-31'
      };

      await Booking.getParkingBookings(filtersWithDates);

      expect(mockCollection.find).toHaveBeenCalledWith({
        parking_id: mockParkingId,
        status: 'confirmed',
        created_at: {
          $gte: new Date('2024-01-01'),
          $lte: new Date('2024-12-31')
        }
      });
    });
  });

  describe('calculateParkingStats', () => {
    beforeEach(() => {
      const mockBookings = [
        { status: 'pending', cost: 5000, created_at: new Date() },
        { status: 'confirmed', cost: 10000, created_at: new Date() },
        { status: 'completed', cost: 15000, created_at: new Date() }
      ];
      mockCollection.toArray.mockResolvedValue(mockBookings);
    });

    it('should calculate parking statistics', async () => {
      const result = await Booking.calculateParkingStats(mockParkingId.toString());

      expect(result.totalBookings).toBe(3);
      expect(result.pendingCount).toBe(1);
      expect(result.confirmedCount).toBe(1);
      expect(result.completedCount).toBe(1);
      expect(result.totalRevenue).toBe(15000); // Only completed bookings
    });
  });

  describe('cancelPendingBooking', () => {
    const mockBooking = {
      _id: mockBookingId,
      status: 'pending'
    };

    beforeEach(() => {
      mockCollection.findOne.mockResolvedValue(mockBooking);
      mockCollection.findOneAndUpdate.mockResolvedValue({
        ...mockBooking,
        status: 'cancelled'
      });
    });

    it('should cancel pending booking successfully', async () => {
      const result = await Booking.cancelPendingBooking(mockBookingId.toString());

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: mockBookingId },
        {
          $set: {
            status: 'cancelled',
            updated_at: expect.any(Date),
            cancelled_at: expect.any(Date)
          }
        },
        { returnDocument: 'after' }
      );
      expect(result.status).toBe('cancelled');
    });

    it('should throw error if booking not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      await expect(Booking.cancelPendingBooking(mockBookingId.toString()))
        .rejects.toThrow('Booking tidak ditemukan');
    });

    it('should throw error if booking is not pending', async () => {
      mockCollection.findOne.mockResolvedValue({ ...mockBooking, status: 'confirmed' });

      await expect(Booking.cancelPendingBooking(mockBookingId.toString()))
        .rejects.toThrow('Booking dengan status "confirmed" tidak dapat dibatalkan');
    });
  });

  describe('cancel', () => {
    const mockBooking = {
      _id: mockBookingId,
      status: 'confirmed',
      vehicle_type: 'car',
      parking_id: mockParkingId
    };

    beforeEach(() => {
      mockCollection.findOne.mockResolvedValue(mockBooking);
      mockCollection.findOneAndUpdate.mockResolvedValue({
        ...mockBooking,
        status: 'cancelled'
      });
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
    });

    it('should cancel confirmed booking and return parking slot', async () => {
      const result = await Booking.cancel(mockBookingId.toString());

      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: mockBookingId });
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: mockBookingId },
        {
          $set: {
            status: 'cancelled',
            updated_at: expect.any(Date),
            cancelled_at: expect.any(Date)
          }
        },
        { returnDocument: 'after' }
      );
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: mockParkingId },
        { $inc: { 'available.car': 1 } }
      );
      expect(result.status).toBe('cancelled');
    });

    it('should throw error if booking already completed', async () => {
      mockCollection.findOne.mockResolvedValue({ ...mockBooking, status: 'completed' });

      await expect(Booking.cancel(mockBookingId.toString()))
        .rejects.toThrow('Booking sudah selesai atau dibatalkan');
    });
  });

  describe('QR Code operations', () => {
    const { verifyQRToken } = require('../../../helpers/qrcode.js');
    
    beforeEach(() => {
      verifyQRToken.mockReturnValue({
        bookingId: mockBookingId.toString(),
        type: 'entry',
        expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
      });
    });

    describe('scanEntryQR', () => {
      const mockBooking = {
        _id: mockBookingId,
        user_id: mockUserId,
        status: 'confirmed'
      };

      beforeEach(() => {
        mockCollection.findOne.mockResolvedValue(mockBooking);
        mockCollection.findOneAndUpdate.mockResolvedValue({
          ...mockBooking,
          status: 'active'
        });
      });

      it('should scan entry QR successfully', async () => {
        const result = await Booking.scanEntryQR('mock-qr-code', mockUserId.toString());

        expect(verifyQRToken).toHaveBeenCalledWith('mock-qr-code');
        expect(result.success).toBe(true);
        expect(result.message).toContain('Entry berhasil');
      });

      it('should throw error for invalid QR code', async () => {
        verifyQRToken.mockReturnValue({ type: 'exit' });

        await expect(Booking.scanEntryQR('invalid-qr', mockUserId.toString()))
          .rejects.toThrow('QR Code tidak valid untuk entry');
      });

      it('should throw error for expired QR code', async () => {
        verifyQRToken.mockReturnValue({
          type: 'entry',
          expiresAt: new Date(Date.now() - 3600000) // 1 hour ago
        });

        await expect(Booking.scanEntryQR('expired-qr', mockUserId.toString()))
          .rejects.toThrow('QR Code sudah expired');
      });

      it('should throw error if user does not own booking', async () => {
        const otherUserId = new ObjectId();

        await expect(Booking.scanEntryQR('mock-qr', otherUserId.toString()))
          .rejects.toThrow('QR Code tidak milik user ini');
      });
    });

    describe('scanExitQR', () => {
      const mockBooking = {
        _id: mockBookingId,
        user_id: mockUserId,
        status: 'active',
        duration: 2,
        start_time: new Date(Date.now() - 7200000), // 2 hours ago
        parking_id: mockParkingId,
        vehicle_type: 'car'
      };

      beforeEach(() => {
        verifyQRToken.mockReturnValue({
          bookingId: mockBookingId.toString(),
          type: 'exit',
          expiresAt: new Date(Date.now() + 3600000)
        });
        
        mockCollection.findOne
          .mockResolvedValueOnce(mockBooking)
          .mockResolvedValueOnce({ rates: { car: 5000 } }); // parking rates
        
        mockCollection.findOneAndUpdate.mockResolvedValue({
          ...mockBooking,
          status: 'completed'
        });
      });

      it('should scan exit QR successfully without overtime', async () => {
        const result = await Booking.scanExitQR('mock-qr-code', mockUserId.toString());

        expect(result.success).toBe(true);
        expect(result.message).toContain('Exit berhasil');
      });

      it('should calculate overtime cost for extended duration', async () => {
        // Mock booking that started 4 hours ago but only booked for 2 hours
        mockCollection.findOne.mockResolvedValueOnce({
          ...mockBooking,
          start_time: new Date(Date.now() - 14400000) // 4 hours ago
        });

        const result = await Booking.scanExitQR('mock-qr-code', mockUserId.toString());        expect(result.overtimeCost).toBeGreaterThan(0);
      });
    });
  });

  describe('create - additional tests', () => {
    const mockBookingData = {
      user_id: mockUserId,
      parking_id: mockParkingId,
      vehicle_type: 'car',
      duration: 2
    };

    it('should throw error if parking not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      await expect(Booking.create(mockBookingData))
        .rejects
        .toThrow('Tempat parkir tidak ditemukan');
    });

    it('should create booking successfully', async () => {
      const mockParking = {
        _id: mockParkingId,
        available: { car: 5 },
        capacity: { car: 10 },
        rates: { car: 10000 }
      };
      
      mockCollection.findOne.mockResolvedValue(mockParking);
      mockCollection.countDocuments.mockResolvedValue(5);
      mockCollection.insertOne.mockResolvedValue({ insertedId: mockBookingId });

      const result = await Booking.create(mockBookingData);

      expect(result).toEqual(expect.objectContaining({
        _id: mockBookingId,
        user_id: mockUserId,
        parking_id: mockParkingId
      }));
    });
  });

  describe('findById', () => {
    it('should find booking by ID', async () => {
      const mockBooking = {
        _id: mockBookingId,
        user_id: mockUserId,
        parking_id: mockParkingId,
        status: 'pending'
      };
      
      mockCollection.findOne.mockResolvedValue(mockBooking);

      const result = await Booking.findById(mockBookingId);

      expect(result).toEqual(mockBooking);
      expect(mockCollection.findOne).toHaveBeenCalledWith({
        _id: mockBookingId
      });
    });

    it('should return null if booking not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await Booking.findById(mockBookingId);

      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update booking status', async () => {
      const mockBooking = {
        _id: mockBookingId,
        status: 'confirmed'
      };
      
      mockCollection.findOneAndUpdate.mockResolvedValue(mockBooking);

      const result = await Booking.updateStatus(mockBookingId, 'confirmed');

      expect(result).toEqual(mockBooking);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: mockBookingId },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'confirmed'
          })
        }),
        expect.objectContaining({
          returnDocument: 'after'
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should throw error if bookingId is not a valid ObjectId in findById', async () => {
      mockCollection.findOne.mockImplementation(() => {
        throw new Error('input must be a 24 character hex string');
      });
      
      await expect(Booking.findById('invalid-id')).rejects.toThrow('input must be a 24 character hex string');
    });

    it('should handle empty results properly', async () => {
      mockCollection.findOne.mockResolvedValue(null);
      
      const result = await Booking.findById(mockBookingId);
      expect(result).toBeNull();
    });  });
});
