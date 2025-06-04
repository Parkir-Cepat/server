import { Booking } from '../../../models/Booking.js';
import { getDB } from '../../../config/db.js';
import { ObjectId } from 'mongodb';

// Mock dependencies
jest.mock('../../../config/db.js');
jest.mock('../../../helpers/qrcode.js', () => ({
  generateBookingQR: jest.fn(),
  generateParkingAccessQR: jest.fn()
}));

describe('Booking Model', () => {
  let mockDb;
  let mockCollection;
  let mockParkingCollection;

  beforeEach(() => {
    mockCollection = {
      findOne: jest.fn(),
      insertOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn(),
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
      createIndex: jest.fn(),
      countDocuments: jest.fn() // Add missing countDocuments mock
    };

    mockParkingCollection = {
      findOne: jest.fn(),
      updateOne: jest.fn()
    };
    
    mockDb = {
      collection: jest.fn((name) => {
        if (name === 'parkings') return mockParkingCollection;
        return mockCollection;
      })
    };
    
    getDB.mockReturnValue(mockDb);
    jest.clearAllMocks();
  });
  describe('setupIndexes', () => {
    it('should create the required indexes', async () => {
      await Booking.setupIndexes();

      expect(mockDb.collection).toHaveBeenCalledWith(Booking.collection);
      expect(mockCollection.createIndex).toHaveBeenCalledTimes(5);
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ user_id: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ parking_id: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ status: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ start_time: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ created_at: 1 });
    });
  });

  describe('findById', () => {
    it('should find booking by ID successfully', async () => {
      const bookingId = '507f1f77bcf86cd799439011';
      const mockBooking = { _id: new ObjectId(bookingId), status: 'pending' };
      
      mockCollection.findOne.mockResolvedValue(mockBooking);
      
      const result = await Booking.findById(bookingId);
      
      expect(mockCollection.findOne).toHaveBeenCalledWith({ 
        _id: new ObjectId(bookingId) 
      });
      expect(result).toEqual(mockBooking);
    });

    it('should return null if booking not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);
      
      const validObjectId = '507f1f77bcf86cd799439011';
      const result = await Booking.findById(validObjectId);
      
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    const mockBookingData = {
      user_id: '507f1f77bcf86cd799439011',
      parking_id: '507f1f77bcf86cd799439012',
      vehicle_type: 'car',
      start_time: '2024-01-01T10:00:00Z',
      duration: 2
    };

    it('should create booking successfully', async () => {
      const mockParking = {
        _id: new ObjectId(mockBookingData.parking_id),
        available: { car: 10 },
        capacity: { car: 20 }, // Add capacity
        rates: { car: 5000 }
      };

      const insertedId = new ObjectId();
      
      mockParkingCollection.findOne.mockResolvedValue(mockParking);
      mockCollection.countDocuments.mockResolvedValue(5); // Mock active bookings count
      mockCollection.insertOne.mockResolvedValue({ insertedId });
      mockParkingCollection.updateOne.mockResolvedValue({});

      const result = await Booking.create(mockBookingData);

      expect(mockParkingCollection.findOne).toHaveBeenCalledWith({
        _id: new ObjectId(mockBookingData.parking_id)
      });

      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: new ObjectId(mockBookingData.user_id),
          parking_id: new ObjectId(mockBookingData.parking_id),
          vehicle_type: mockBookingData.vehicle_type,
          duration: mockBookingData.duration,
          cost: 10000, // 5000 * 2 hours
          status: 'pending',
          created_at: expect.any(Date),
          updated_at: expect.any(Date)
        })
      );

      expect(result._id).toBe(insertedId);
    });

    it('should throw error if parking lot not found', async () => {
      mockParkingCollection.findOne.mockResolvedValue(null);

      await expect(Booking.create(mockBookingData))
        .rejects.toThrow('Tempat parkir tidak ditemukan');
    });

    it('should throw error if no available slots', async () => {
      const mockParking = {
        _id: new ObjectId(mockBookingData.parking_id),
        available: { car: 0 },
        capacity: { car: 10 }, // Add capacity
        rates: { car: 5000 }
      };

      mockParkingCollection.findOne.mockResolvedValue(mockParking);
      mockCollection.countDocuments.mockResolvedValue(0);

      // Update expected error message to match implementation
      await expect(Booking.create(mockBookingData))
        .rejects.toThrow('Slot parkir car tidak tersedia. Available: 0, Capacity: 10');
    });

    it('should calculate cost correctly', async () => {
      const mockParking = {
        _id: new ObjectId(mockBookingData.parking_id),
        available: { car: 5 },
        capacity: { car: 10 }, // Add capacity
        rates: { car: 7500 }
      };

      const bookingData = { ...mockBookingData, duration: 3 };
      
      mockParkingCollection.findOne.mockResolvedValue(mockParking);
      mockCollection.countDocuments.mockResolvedValue(2); // Mock active bookings count
      mockCollection.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
      mockParkingCollection.updateOne.mockResolvedValue({});

      await Booking.create(bookingData);

      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          cost: 22500 // 7500 * 3 hours
        })
      );
    });
  });

  describe('updateStatus', () => {
    it('should update booking status successfully', async () => {
      const bookingId = '507f1f77bcf86cd799439011';
      const newStatus = 'confirmed';
      const updatedBooking = { _id: new ObjectId(bookingId), status: newStatus };

      mockCollection.findOneAndUpdate.mockResolvedValue(updatedBooking);

      const result = await Booking.updateStatus(bookingId, newStatus);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new ObjectId(bookingId) },
        { 
          $set: {
            status: newStatus,
            updated_at: expect.any(Date)
          }
        },
        { returnDocument: 'after' }
      );

      expect(result).toEqual(updatedBooking);
    });
  });

  describe('getActiveBookings', () => {
    it('should get active bookings for user', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockBookings = [
        { _id: new ObjectId(), status: 'pending' },
        { _id: new ObjectId(), status: 'confirmed' }
      ];

      mockCollection.toArray.mockResolvedValue(mockBookings);

      const result = await Booking.getActiveBookings(userId);

      expect(mockCollection.find).toHaveBeenCalledWith({
        user_id: new ObjectId(userId),
        status: { $in: ['pending', 'confirmed', 'active', 'completed'] }
      });
      expect(mockCollection.sort).toHaveBeenCalledWith({ created_at: -1 });
      expect(result).toEqual(mockBookings);
    });
  });

  describe('getBookingHistory', () => {
    it('should get booking history for user', async () => {
      const userId = '507f1f77bcf86cd799439011';
      const mockBookings = [
        { _id: new ObjectId(), status: 'completed' },
        { _id: new ObjectId(), status: 'cancelled' }
      ];

      mockCollection.toArray.mockResolvedValue(mockBookings);

      const result = await Booking.getBookingHistory(userId);

      expect(mockCollection.find).toHaveBeenCalledWith({
        user_id: new ObjectId(userId),
        status: { $in: ['completed', 'cancelled'] }
      });
      expect(mockCollection.sort).toHaveBeenCalledWith({ start_time: -1 });
      expect(result).toEqual(mockBookings);
    });
  });

  describe('getExpiredBookings', () => {
    it('should get expired bookings', async () => {
      const mockExpiredBookings = [
        { _id: new ObjectId(), status: 'pending' },
        { _id: new ObjectId(), status: 'confirmed' }
      ];

      mockCollection.toArray.mockResolvedValue(mockExpiredBookings);

      const result = await Booking.getExpiredBookings();

      expect(mockCollection.find).toHaveBeenCalledWith({
        status: { $in: ['pending', 'confirmed'] },
        $expr: {
          $lt: [
            {
              $add: [
                '$start_time',
                { $multiply: ['$duration', 60 * 60 * 1000] }
              ]
            },
            expect.any(Date)
          ]
        }
      });

      expect(result).toEqual(mockExpiredBookings);
    });
  });

  describe('generateQRCode', () => {
    it('should generate QR code for confirmed booking', async () => {
      const bookingId = '507f1f77bcf86cd799439011';
      const mockBooking = { 
        _id: new ObjectId(bookingId), 
        status: 'confirmed' 
      };
      const mockQRCode = 'data:image/png;base64,mockqr';
      const updatedBooking = { ...mockBooking, qrCode: mockQRCode };

      const { generateBookingQR } = require('../../../helpers/qrcode.js');
      
      mockCollection.findOne.mockResolvedValue(mockBooking);
      generateBookingQR.mockResolvedValue(mockQRCode);
      mockCollection.findOneAndUpdate.mockResolvedValue(updatedBooking);

      const result = await Booking.generateQRCode(bookingId);

      expect(generateBookingQR).toHaveBeenCalledWith(mockBooking);
      // Fix field names to match implementation
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new ObjectId(bookingId) },
        { 
          $set: {
            qrCode: mockQRCode, // Changed from qr_code
            updatedAt: expect.any(Date) // Changed from updated_at
          }
        },
        { returnDocument: 'after' }
      );

      expect(result).toEqual(updatedBooking);
    });

    it('should throw error if booking not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const validObjectId = '507f1f77bcf86cd799439011';
      await expect(Booking.generateQRCode(validObjectId))
        .rejects.toThrow('Booking tidak ditemukan');
    });
  });

  describe('cancel', () => {
    it('should cancel booking successfully', async () => {
      const bookingId = '507f1f77bcf86cd799439011';
      const mockBooking = { 
        _id: new ObjectId(bookingId), 
        status: 'pending',
        parking_id: new ObjectId(),
        vehicle_type: 'car'
      };
      const cancelledBooking = { ...mockBooking, status: 'cancelled' };

      mockCollection.findOne.mockResolvedValue(mockBooking);
      mockCollection.findOneAndUpdate.mockResolvedValue(cancelledBooking);
      mockParkingCollection.updateOne.mockResolvedValue({});

      const result = await Booking.cancel(bookingId);

      // Update expectation to include cancelled_at field
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new ObjectId(bookingId) },
        { 
          $set: {
            status: 'cancelled',
            cancelled_at: expect.any(Date), // Add cancelled_at field
            updated_at: expect.any(Date)
          }
        },
        { returnDocument: 'after' }
      );

      expect(result).toEqual(cancelledBooking);
    });

    it('should throw error if booking not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const validObjectId = '507f1f77bcf86cd799439011';
      await expect(Booking.cancel(validObjectId))
        .rejects.toThrow('Booking tidak ditemukan');
    });
  });

  describe('setupIndexes', () => {
    it('should create database indexes', async () => {
      mockCollection.createIndex.mockResolvedValue({});

      await Booking.setupIndexes();

      expect(mockCollection.createIndex).toHaveBeenCalledTimes(5);
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ user_id: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ parking_id: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ status: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ start_time: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ created_at: 1 });
    });
  });
});