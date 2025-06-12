import { Booking } from '../../../models/Booking.js';
import { getDB } from '../../../config/db.js';
import { ObjectId } from 'mongodb';
import { generateBookingQR, generateEntryQRToken, generateExitQRToken, verifyQRToken } from '../../../helpers/qrcode.js';

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
      toArray: jest.fn()
    };

    mockSession = {
      withTransaction: jest.fn(callback => callback()),
      endSession: jest.fn()
    };

    mockDB = {
      collection: jest.fn().mockReturnValue(mockCollection),
      client: {
        startSession: jest.fn().mockReturnValue(mockSession)
      }
    };

    getDB.mockReturnValue(mockDB);
  });

  describe('Validation & Input Tests', () => {
    describe('create', () => {
      const mockBookingData = {
        user_id: mockUserId,
        parking_id: mockParkingId,
        vehicle_type: 'car',
        start_time: new Date(),
        duration: 2
      };

      it('should throw error if parking not found', async () => {
        mockCollection.findOne.mockResolvedValue(null);

        await expect(Booking.create(mockBookingData))
          .rejects
          .toThrow('Tempat parkir tidak ditemukan');
      });

      it('should throw error if no available slots', async () => {
        const mockParking = {
          _id: mockParkingId,
          available: { car: 0 },
          capacity: { car: 10 },
          rates: { car: 10000 }
        };

        mockCollection.findOne.mockResolvedValue(mockParking);

        await expect(Booking.create(mockBookingData))
          .rejects
          .toThrow(/Slot parkir car tidak tersedia/);
      });

      it('should throw error if vehicle type price not available', async () => {
        const mockParking = {
          _id: mockParkingId,
          available: { car: 5 },
          capacity: { car: 10 },
          rates: { motorcycle: 5000 } // No car rate
        };

        mockCollection.findOne.mockResolvedValue(mockParking);

        await expect(Booking.create(mockBookingData))
          .rejects
          .toThrow('Harga untuk car tidak tersedia');
      });

      it('should throw error if parking is full', async () => {
        const mockParking = {
          _id: mockParkingId,
          available: { car: 5 },
          capacity: { car: 10 },
          rates: { car: 10000 }
        };

        mockCollection.findOne.mockResolvedValue(mockParking);
        mockCollection.countDocuments.mockResolvedValue(10); // Full capacity

        await expect(Booking.create(mockBookingData))
          .rejects
          .toThrow(/Slot parkir car sudah penuh/);
      });

      it('should create booking successfully', async () => {
        const mockParking = {
          _id: mockParkingId,
          available: { car: 5 },
          capacity: { car: 10 },
          rates: { car: 10000 }
        };

        mockCollection.findOne.mockResolvedValue(mockParking);
        mockCollection.countDocuments.mockResolvedValue(5); // Half capacity
        mockCollection.insertOne.mockResolvedValue({ insertedId: mockBookingId });

        const result = await Booking.create(mockBookingData);

        expect(result).toEqual(expect.objectContaining({
          _id: mockBookingId,
          user_id: mockUserId,
          parking_id: mockParkingId,
          vehicle_type: 'car',
          cost: 20000, // 2 hours * 10000
          status: 'pending'
        }));
      });
    });
  });

  describe('CRUD Operations', () => {
    describe('findById', () => {
      it('should find booking by ID', async () => {
        const mockBooking = {
          _id: mockBookingId,
          user_id: mockUserId,
          status: 'pending'
        };

        mockCollection.findOne.mockResolvedValue(mockBooking);

        const result = await Booking.findById(mockBookingId);

        expect(result).toEqual(mockBooking);
        expect(mockCollection.findOne).toHaveBeenCalledWith({
          _id: expect.any(ObjectId)
        });
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
          { _id: expect.any(ObjectId) },
          {
            $set: {
              status: 'confirmed',
              updated_at: expect.any(Date)
            }
          },
          { returnDocument: 'after' }
        );
      });
    });
  });

  describe('Business Logic', () => {
    describe('processPayment', () => {
      const mockBooking = {
        _id: mockBookingId,
        user_id: mockUserId,
        parking_id: mockParkingId,
        vehicle_type: 'car',
        cost: 20000,
        status: 'pending'
      };

      const mockUser = {
        _id: mockUserId,
        saldo: 100000
      };

      const mockParking = {
        _id: mockParkingId,
        available: { car: 5 }
      };

      beforeEach(() => {
        // Reset all mocks before each test
        mockCollection.findOne.mockReset();
        mockCollection.updateOne.mockReset();
        mockSession.withTransaction.mockReset();
      });

      it('should throw error if booking not found', async () => {
        mockCollection.findOne.mockResolvedValue(null);

        await expect(Booking.processPayment(mockBookingId, mockUserId.toString()))
          .rejects
          .toThrow('Booking tidak ditemukan');
      });

      it('should throw error if user not authorized', async () => {
        const differentUserId = new ObjectId();
        mockCollection.findOne.mockResolvedValue(mockBooking);
        
        await expect(Booking.processPayment(mockBookingId, differentUserId.toString()))
          .rejects
          .toThrow('Unauthorized - booking tidak milik user ini');
      });

      it('should throw error if booking already paid', async () => {
        const paidBooking = { ...mockBooking, status: 'confirmed' };
        mockCollection.findOne.mockResolvedValue(paidBooking);

        await expect(Booking.processPayment(mockBookingId, mockUserId.toString()))
          .rejects
          .toThrow('Booking sudah dibayar atau dibatalkan');
      });

      it('should throw error if insufficient balance', async () => {
        const poorUser = { ...mockUser, saldo: 10000 }; // Saldo < cost (20000)
        
        mockCollection.findOne
          .mockResolvedValueOnce(mockBooking)  // First findOne for booking
          .mockResolvedValueOnce(poorUser);    // Second findOne for user

        await expect(Booking.processPayment(mockBookingId, mockUserId.toString()))
          .rejects
          .toThrow(/Saldo tidak cukup/);
      });

      it('should throw error if no available slots', async () => {
        const fullParking = { ...mockParking, available: { car: 0 } };
        
        mockCollection.findOne
          .mockResolvedValueOnce(mockBooking)  // First findOne for booking
          .mockResolvedValueOnce(mockUser)     // Second findOne for user
          .mockResolvedValueOnce(fullParking); // Third findOne for parking

        await expect(Booking.processPayment(mockBookingId, mockUserId.toString()))
          .rejects
          .toThrow(/Slot parkir car sudah tidak tersedia/);
      });

      it('should process payment successfully', async () => {
        const updatedBooking = { ...mockBooking, status: 'confirmed' };
        
        // Setup mocks for the entire flow
        mockCollection.findOne
          .mockResolvedValueOnce(mockBooking)  // First findOne for initial booking check
          .mockResolvedValueOnce(mockUser)     // Second findOne for user check
          .mockResolvedValueOnce(mockParking)  // Third findOne for parking check
          .mockResolvedValueOnce(updatedBooking); // Fourth findOne for final booking check

        // Mock successful updates
        mockCollection.updateOne
          .mockResolvedValueOnce({ modifiedCount: 1 }) // User balance update
          .mockResolvedValueOnce({ modifiedCount: 1 }) // Parking slot update
          .mockResolvedValueOnce({ modifiedCount: 1 }); // Booking status update

        // Mock successful transaction
        mockSession.withTransaction.mockImplementation(async (callback) => {
          await callback();
          return true;
        });

        const result = await Booking.processPayment(mockBookingId, mockUserId.toString());

        expect(result).toEqual(updatedBooking);
        expect(mockSession.withTransaction).toHaveBeenCalled();
        expect(mockCollection.updateOne).toHaveBeenCalledTimes(3);
        
        // Verify specific updates
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
          { _id: mockUserId },
          { $inc: { saldo: -20000 } },
          { session: mockSession }
        );
        
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
          { _id: mockParkingId },
          { $inc: { "available.car": -1 } },
          { session: mockSession }
        );
        
        expect(mockCollection.updateOne).toHaveBeenCalledWith(
          { _id: mockBookingId },
          {
            $set: {
              status: 'confirmed',
              updated_at: expect.any(Date)
            }
          },
          { session: mockSession }
        );
      });
    });

    describe('getActiveBookings', () => {
      it('should return active bookings for user', async () => {
        const mockBookings = [
          {
            _id: mockBookingId,
            user_id: mockUserId,
            status: 'active'
          }
        ];

        mockCollection.toArray.mockResolvedValue(mockBookings);

        const result = await Booking.getActiveBookings(mockUserId);

        expect(result).toEqual(mockBookings);
        expect(mockCollection.find).toHaveBeenCalledWith({
          user_id: expect.any(ObjectId),
          status: { $in: ['pending', 'confirmed', 'active', 'completed'] }
        });
      });
    });

    describe('getCurrentActiveBookings', () => {
      it('should return current active bookings for user', async () => {
        const mockBookings = [
          {
            _id: mockBookingId,
            user_id: mockUserId,
            status: 'active'
          }
        ];

        mockCollection.toArray.mockResolvedValue(mockBookings);

        const result = await Booking.getCurrentActiveBookings(mockUserId);

        expect(result).toEqual(mockBookings);
        expect(mockCollection.find).toHaveBeenCalledWith({
          user_id: expect.any(ObjectId),
          status: { $in: ['confirmed', 'active'] }
        });
      });
    });
  });
});