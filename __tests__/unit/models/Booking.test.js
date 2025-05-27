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
      createIndex: jest.fn()
    };

    mockParkingCollection = {
      findOne: jest.fn(),
      updateOne: jest.fn()
    };
    
    mockDb = {
      collection: jest.fn((name) => {
        if (name === 'bookings') return mockCollection;
        if (name === 'parkings') return mockParkingCollection;
        return mockCollection;
      })
    };
    
    getDB.mockReturnValue(mockDb);
    jest.clearAllMocks();
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
      userId: '507f1f77bcf86cd799439011',
      parkingLotId: '507f1f77bcf86cd799439012',
      vehicleType: 'car',
      startTime: '2024-01-01T10:00:00Z',
      duration: 2
    };

    it('should create booking successfully', async () => {
      const mockParking = {
        _id: new ObjectId(mockBookingData.parkingLotId),
        availableSlots: 10,
        tariff: 5000
      };

      const insertedId = new ObjectId();
      
      mockParkingCollection.findOne.mockResolvedValue(mockParking);
      mockCollection.insertOne.mockResolvedValue({ insertedId });
      mockParkingCollection.updateOne.mockResolvedValue({});

      const result = await Booking.create(mockBookingData);

      expect(mockParkingCollection.findOne).toHaveBeenCalledWith({
        _id: new ObjectId(mockBookingData.parkingLotId)
      });

      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: new ObjectId(mockBookingData.userId),
          parkingLotId: new ObjectId(mockBookingData.parkingLotId),
          vehicleType: mockBookingData.vehicleType,
          duration: mockBookingData.duration,
          cost: 10000, // 5000 * 2 hours
          status: 'pending'
        })
      );

      expect(mockParkingCollection.updateOne).toHaveBeenCalledWith(
        { _id: new ObjectId(mockBookingData.parkingLotId) },
        { $inc: { availableSlots: -1 } }
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
        _id: new ObjectId(mockBookingData.parkingLotId),
        availableSlots: 0,
        tariff: 5000
      };

      mockParkingCollection.findOne.mockResolvedValue(mockParking);

      await expect(Booking.create(mockBookingData))
        .rejects.toThrow('Slot parkir tidak tersedia');
    });

    it('should calculate cost correctly', async () => {
      const mockParking = {
        _id: new ObjectId(mockBookingData.parkingLotId),
        availableSlots: 5,
        tariff: 7500
      };

      const bookingData = { ...mockBookingData, duration: 3 };
      
      mockParkingCollection.findOne.mockResolvedValue(mockParking);
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

      mockCollection.findOneAndUpdate.mockResolvedValue({ value: updatedBooking });

      const result = await Booking.updateStatus(bookingId, newStatus);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new ObjectId(bookingId) },
        { 
          $set: {
            status: newStatus,
            updatedAt: expect.any(Date)
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
        userId: new ObjectId(userId),
        status: { $in: ['pending', 'confirmed'] }
      });
      expect(mockCollection.sort).toHaveBeenCalledWith({ startTime: -1 });
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
        userId: new ObjectId(userId),
        status: { $in: ['completed', 'cancelled'] }
      });
      expect(mockCollection.sort).toHaveBeenCalledWith({ startTime: -1 });
      expect(result).toEqual(mockBookings);
    });
  });

  describe('extend', () => {
    it('should extend booking duration and cost', async () => {
      const bookingId = '507f1f77bcf86cd799439011';
      const additionalDuration = 1;
      const additionalCost = 5000;
      const extendedBooking = { _id: new ObjectId(bookingId), duration: 3, cost: 15000 };

      mockCollection.findOneAndUpdate.mockResolvedValue({ value: extendedBooking });

      const result = await Booking.extend(bookingId, additionalDuration, additionalCost);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new ObjectId(bookingId) },
        { 
          $inc: {
            duration: additionalDuration,
            cost: additionalCost
          },
          $set: { updatedAt: expect.any(Date) }
        },
        { returnDocument: 'after' }
      );

      expect(result).toEqual(extendedBooking);
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
                '$startTime',
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
      mockCollection.findOneAndUpdate.mockResolvedValue({ value: updatedBooking });

      const result = await Booking.generateQRCode(bookingId);

      expect(generateBookingQR).toHaveBeenCalledWith(mockBooking);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new ObjectId(bookingId) },
        { 
          $set: {
            qrCode: mockQRCode,
            updatedAt: expect.any(Date)
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

    it('should throw error if booking not confirmed', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      const mockBooking = { 
        _id: new ObjectId(validObjectId), 
        status: 'pending' 
      };

      mockCollection.findOne.mockResolvedValue(mockBooking);

      await expect(Booking.generateQRCode(validObjectId))
        .rejects.toThrow('QR Code hanya bisa dibuat untuk booking yang sudah dikonfirmasi');
    });
  });

  describe('generateAccessQR', () => {
    it('should generate entry access QR', async () => {
      const bookingId = '507f1f77bcf86cd799439011';
      const mockBooking = { 
        _id: new ObjectId(bookingId), 
        status: 'confirmed',
        parkingLotId: new ObjectId()
      };
      const mockQRCode = 'data:image/png;base64,entryqr';

      const { generateParkingAccessQR } = require('../../../helpers/qrcode.js');
      
      mockCollection.findOne.mockResolvedValue(mockBooking);
      generateParkingAccessQR.mockResolvedValue(mockQRCode);
      mockCollection.updateOne.mockResolvedValue({});

      const result = await Booking.generateAccessQR(bookingId, 'entry');

      expect(generateParkingAccessQR).toHaveBeenCalledWith({
        type: 'entry',
        bookingId,
        parkingLotId: mockBooking.parkingLotId.toString()
      });

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: new ObjectId(bookingId) },
        { 
          $set: {
            entryQR: mockQRCode,
            updatedAt: expect.any(Date)
          }
        }
      );

      expect(result).toBe(mockQRCode);
    });

    it('should generate exit access QR', async () => {
      const bookingId = '507f1f77bcf86cd799439011';
      const mockBooking = { 
        _id: new ObjectId(bookingId), 
        status: 'confirmed',
        parkingLotId: new ObjectId()
      };
      const mockQRCode = 'data:image/png;base64,exitqr';

      const { generateParkingAccessQR } = require('../../../helpers/qrcode.js');
      
      mockCollection.findOne.mockResolvedValue(mockBooking);
      generateParkingAccessQR.mockResolvedValue(mockQRCode);
      mockCollection.updateOne.mockResolvedValue({});

      const result = await Booking.generateAccessQR(bookingId, 'exit');

      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: new ObjectId(bookingId) },
        { 
          $set: {
            exitQR: mockQRCode,
            updatedAt: expect.any(Date)
          }
        }
      );

      expect(result).toBe(mockQRCode);
    });
  });

  describe('findByParkingLot', () => {
    it('should find bookings by parking lot', async () => {
      const parkingLotId = '507f1f77bcf86cd799439012';
      const mockBookings = [
        { _id: new ObjectId(), parkingLotId: new ObjectId(parkingLotId) }
      ];

      mockCollection.toArray.mockResolvedValue(mockBookings);

      const result = await Booking.findByParkingLot(parkingLotId);

      expect(mockCollection.find).toHaveBeenCalledWith({
        parkingLotId: new ObjectId(parkingLotId)
      });
      expect(mockCollection.sort).toHaveBeenCalledWith({ startTime: -1 });
      expect(result).toEqual(mockBookings);
    });
  });

  describe('cancel', () => {
    it('should cancel booking successfully', async () => {
      const bookingId = '507f1f77bcf86cd799439011';
      const mockBooking = { 
        _id: new ObjectId(bookingId), 
        status: 'pending',
        parkingLotId: new ObjectId()
      };
      const cancelledBooking = { ...mockBooking, status: 'cancelled' };

      mockCollection.findOne.mockResolvedValue(mockBooking);
      mockCollection.findOneAndUpdate.mockResolvedValue({ value: cancelledBooking });
      mockParkingCollection.updateOne.mockResolvedValue({});

      const result = await Booking.cancel(bookingId);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new ObjectId(bookingId) },
        { 
          $set: {
            status: 'cancelled',
            updatedAt: expect.any(Date)
          }
        },
        { returnDocument: 'after' }
      );

      expect(mockParkingCollection.updateOne).toHaveBeenCalledWith(
        { _id: mockBooking.parkingLotId },
        { $inc: { availableSlots: 1 } }
      );

      expect(result).toEqual(cancelledBooking);
    });

    it('should throw error if booking not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const validObjectId = '507f1f77bcf86cd799439011';
      await expect(Booking.cancel(validObjectId))
        .rejects.toThrow('Booking tidak ditemukan');
    });

    it('should throw error if booking already completed', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      const mockBooking = { 
        _id: new ObjectId(validObjectId), 
        status: 'completed' 
      };

      mockCollection.findOne.mockResolvedValue(mockBooking);

      await expect(Booking.cancel(validObjectId))
        .rejects.toThrow('Booking sudah selesai atau dibatalkan');
    });

    it('should throw error if booking already cancelled', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      const mockBooking = { 
        _id: new ObjectId(validObjectId), 
        status: 'cancelled' 
      };

      mockCollection.findOne.mockResolvedValue(mockBooking);

      await expect(Booking.cancel(validObjectId))
        .rejects.toThrow('Booking sudah selesai atau dibatalkan');
    });
  });

  describe('confirm', () => {
    it('should confirm booking successfully', async () => {
      const bookingId = '507f1f77bcf86cd799439011';
      const confirmedBooking = { 
        _id: new ObjectId(bookingId), 
        status: 'confirmed' 
      };

      mockCollection.findOneAndUpdate.mockResolvedValue({ value: confirmedBooking });

      const result = await Booking.confirm(bookingId);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: new ObjectId(bookingId) },
        { 
          $set: {
            status: 'confirmed',
            updatedAt: expect.any(Date)
          }
        },
        { returnDocument: 'after' }
      );

      expect(result).toEqual(confirmedBooking);
    });
  });

  describe('setupIndexes', () => {
    it('should create database indexes', async () => {
      mockCollection.createIndex.mockResolvedValue({});

      await Booking.setupIndexes();

      expect(mockCollection.createIndex).toHaveBeenCalledTimes(4);
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ userId: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ parkingLotId: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ status: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ startTime: 1 });
    });
  });
}); 