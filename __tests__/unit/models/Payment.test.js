import { Payment } from '../../../models/Payment.js';
import { getDB } from '../../../config/db.js';

jest.mock('../../../config/db.js');

describe('Payment Model', () => {
  let mockDb;
  let mockCollection;
  let mockBookingCollection;

  beforeEach(() => {
    mockCollection = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
      insertOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      createIndex: jest.fn(),
      project: jest.fn().mockReturnThis()
    };
    mockBookingCollection = {
      find: jest.fn().mockReturnThis(),
      project: jest.fn().mockReturnThis(),
      toArray: jest.fn()
    };
    mockDb = {
      collection: jest.fn((name) => {
        if (name === 'payments') return mockCollection;
        if (name === 'bookings') return mockBookingCollection;
        return mockCollection;
      })
    };
    getDB.mockReturnValue(mockDb);
    jest.clearAllMocks();
  });

  describe('setupIndexes', () => {
    it('should create indexes', async () => {
      mockCollection.createIndex.mockResolvedValue({});
      await Payment.setupIndexes();
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ bookingId: 1 }, { unique: true });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ transactionId: 1 }, { unique: true });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ status: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ createdAt: 1 });
    });
  });

  describe('findById', () => {
    it('should find payment by ID', async () => {
      const id = 'payid123';
      const mockPayment = { _id: id, amount: 10000 };
      mockCollection.findOne.mockResolvedValue(mockPayment);
      const result = await Payment.findById(id);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: id });
      expect(result).toEqual(mockPayment);
    });
  });

  describe('findByTransactionId', () => {
    it('should find payment by transactionId', async () => {
      const transactionId = 'trx-001';
      const mockPayment = { transactionId, amount: 20000 };
      mockCollection.findOne.mockResolvedValue(mockPayment);
      const result = await Payment.findByTransactionId(transactionId);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ transactionId });
      expect(result).toEqual(mockPayment);
    });
  });

  describe('getByBooking', () => {
    it('should get payment by bookingId', async () => {
      const bookingId = 'booking-001';
      const mockPayment = { bookingId, amount: 30000 };
      mockCollection.findOne.mockResolvedValue(mockPayment);
      const result = await Payment.getByBooking(bookingId);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ bookingId });
      expect(result).toEqual(mockPayment);
    });
  });

  describe('getByUser', () => {
    it('should get payments by user', async () => {
      const userId = 'user123';
      const bookings = [{ _id: 'booking-1' }, { _id: 'booking-2' }];
      const payments = [{ bookingId: 'booking-1' }, { bookingId: 'booking-2' }];
      mockBookingCollection.toArray.mockResolvedValue(bookings);
      mockCollection.toArray.mockResolvedValue(payments);
      mockCollection.find.mockReturnThis();
      mockCollection.sort.mockReturnThis();
      const result = await Payment.getByUser(userId);
      expect(mockBookingCollection.find).toHaveBeenCalledWith({ userId });
      expect(mockBookingCollection.project).toHaveBeenCalledWith({ _id: 1 });
      expect(mockCollection.find).toHaveBeenCalledWith({ bookingId: { $in: ['booking-1', 'booking-2'] } });
      expect(mockCollection.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toEqual(payments);
    });
    it('should return empty array if no bookings', async () => {
      const userId = 'user123';
      mockBookingCollection.toArray.mockResolvedValue([]);
      mockCollection.toArray.mockResolvedValue([]);
      mockCollection.find.mockReturnThis();
      mockCollection.sort.mockReturnThis();
      const result = await Payment.getByUser(userId);
      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('should create a payment', async () => {
      const paymentData = {
        bookingId: 'booking-001',
        transactionId: 'trx-001',
        paymentMethod: 'bank',
        amount: 10000,
        status: 'pending',
        qrCodeUrl: 'http://qr.com/abc'
      };
      const insertedId = 'payid123';
      mockCollection.insertOne.mockResolvedValue({ insertedId });
      const result = await Payment.create(paymentData);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        bookingId: paymentData.bookingId,
        transactionId: paymentData.transactionId,
        paymentMethod: paymentData.paymentMethod,
        amount: paymentData.amount,
        status: paymentData.status,
        qrCodeUrl: paymentData.qrCodeUrl,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }));
      expect(result._id).toBe(insertedId);
    });
  });

  describe('updateStatus', () => {
    it('should update status by id', async () => {
      const id = 'payid123';
      const status = 'success';
      const updatedPayment = { _id: id, status };
      mockCollection.findOneAndUpdate.mockResolvedValue(updatedPayment);
      const result = await Payment.updateStatus(id, status);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: id },
        { $set: { status, updatedAt: expect.any(Date) } },
        { returnDocument: 'after' }
      );
      expect(result).toEqual(updatedPayment);
    });
  });

  describe('updateStatusByTransactionId', () => {
    it('should update status by transactionId', async () => {
      const transactionId = 'trx-001';
      const status = 'failed';
      const updatedPayment = { transactionId, status };
      mockCollection.findOneAndUpdate.mockResolvedValue(updatedPayment);
      const result = await Payment.updateStatusByTransactionId(transactionId, status);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { transactionId },
        { $set: { status, updatedAt: expect.any(Date) } },
        { returnDocument: 'after' }
      );
      expect(result).toEqual(updatedPayment);
    });
  });
}); 