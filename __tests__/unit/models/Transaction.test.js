/**
 * @jest-environment node
 */

import { Transaction } from '../../../models/Transaction.js';
import { ObjectId } from 'mongodb';

// Global mocks
global.ObjectId = ObjectId;

// Mock dependencies
jest.mock('../../../config/db.js');

describe('Transaction Model', () => {
  let mockDB, mockCollection;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockCollection = {
      findOne: jest.fn(),
      insertOne: jest.fn(),
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
      updateOne: jest.fn(),
      deleteOne: jest.fn(),
      countDocuments: jest.fn(),
      createIndex: jest.fn().mockResolvedValue(),
      aggregate: jest.fn(),
      limit: jest.fn(),
      sort: jest.fn(),
      toArray: jest.fn()
    };

    mockCollection.find.mockReturnValue(mockCollection);
    mockCollection.limit.mockReturnValue(mockCollection);
    mockCollection.sort.mockReturnValue(mockCollection);
    mockCollection.aggregate.mockReturnValue(mockCollection);

    mockDB = {
      collection: jest.fn().mockReturnValue(mockCollection)
    };

    const { getDB } = require('../../../config/db.js');
    getDB.mockReturnValue(mockDB);
  });

  describe('setupIndexes', () => {
    it('should create indexes successfully', async () => {
      await Transaction.setupIndexes();

      expect(mockDB.collection).toHaveBeenCalledWith('transactions');
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ user_id: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ booking_id: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ status: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ type: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ created_at: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ transaction_id: 1 });
    });

    it('should handle index creation errors', async () => {
      mockCollection.createIndex.mockRejectedValue(new Error('Index creation failed'));

      await expect(Transaction.setupIndexes()).rejects.toThrow('Index creation failed');
    });
  });

  describe('findById', () => {
    it('should find transaction by id successfully', async () => {
      const transactionId = new ObjectId();
      const mockTransaction = {
        _id: transactionId,
        user_id: new ObjectId(),
        amount: 50000,
        type: 'payment',
        status: 'pending'
      };

      mockCollection.findOne.mockResolvedValue(mockTransaction);

      const result = await Transaction.findById(transactionId.toString());

      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: transactionId });
      expect(result).toEqual(mockTransaction);
    });

    it('should return null if transaction not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await Transaction.findById(new ObjectId().toString());

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockCollection.findOne.mockRejectedValue(new Error('Database error'));

      await expect(Transaction.findById(new ObjectId().toString())).rejects.toThrow('Database error');
    });
  });

  describe('create', () => {
    it('should create transaction with all fields', async () => {
      const transactionData = {
        user_id: new ObjectId().toString(),
        booking_id: new ObjectId().toString(),
        amount: 50000,
        type: 'payment',
        payment_method: 'qris',
        status: 'pending',
        transaction_id: 'TRX-123456',
        qr_code_url: 'https://example.com/qr',
        description: 'Parking payment'
      };

      const mockInsertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

      const result = await Transaction.create(transactionData);

      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        user_id: new ObjectId(transactionData.user_id),
        booking_id: new ObjectId(transactionData.booking_id),
        amount: transactionData.amount,
        type: transactionData.type,
        payment_method: transactionData.payment_method,
        status: transactionData.status,
        transaction_id: transactionData.transaction_id,
        qr_code_url: transactionData.qr_code_url,
        description: transactionData.description,
        created_at: expect.any(Date),
        updated_at: expect.any(Date)
      });

      expect(result).toEqual({
        _id: mockInsertedId,
        user_id: new ObjectId(transactionData.user_id),
        booking_id: new ObjectId(transactionData.booking_id),
        amount: transactionData.amount,
        type: transactionData.type,
        payment_method: transactionData.payment_method,
        status: transactionData.status,
        transaction_id: transactionData.transaction_id,
        qr_code_url: transactionData.qr_code_url,
        description: transactionData.description,
        created_at: expect.any(Date),
        updated_at: expect.any(Date)
      });
    });

    it('should create transaction with default values', async () => {
      const transactionData = {
        user_id: new ObjectId().toString(),
        amount: 50000,
        type: 'top-up'
      };

      const mockInsertedId = new ObjectId();
      mockCollection.insertOne.mockResolvedValue({ insertedId: mockInsertedId });

      const result = await Transaction.create(transactionData);

      expect(mockCollection.insertOne).toHaveBeenCalledWith({
        user_id: new ObjectId(transactionData.user_id),
        booking_id: null,
        amount: transactionData.amount,
        type: transactionData.type,
        payment_method: 'manual',
        status: 'pending',
        transaction_id: expect.stringMatching(/^TRX-\d+$/),
        qr_code_url: null,
        description: '',
        created_at: expect.any(Date),
        updated_at: expect.any(Date)
      });

      expect(result.payment_method).toBe('manual');
      expect(result.status).toBe('pending');
      expect(result.booking_id).toBeNull();
      expect(result.qr_code_url).toBeNull();
      expect(result.description).toBe('');
    });

    it('should handle database errors during creation', async () => {
      const transactionData = {
        user_id: new ObjectId().toString(),
        amount: 50000,
        type: 'payment'
      };

      mockCollection.insertOne.mockRejectedValue(new Error('Insert failed'));

      await expect(Transaction.create(transactionData)).rejects.toThrow('Insert failed');
    });
  });

  describe('updateStatus', () => {
    beforeEach(() => {
      // Suppress console logs during tests
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      console.log.mockRestore();
      console.error.mockRestore();
    });

    it('should update status by ObjectId successfully', async () => {
      const transactionId = new ObjectId();
      const existingTransaction = {
        _id: transactionId,
        transaction_id: 'TRX-123',
        status: 'pending'
      };
      const updatedTransaction = {
        ...existingTransaction,
        status: 'success',
        updated_at: new Date()
      };

      mockCollection.findOne.mockResolvedValue(existingTransaction);
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });
      mockCollection.findOne.mockResolvedValueOnce(existingTransaction).mockResolvedValueOnce(updatedTransaction);

      const result = await Transaction.updateStatus(transactionId.toString(), 'success');

      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: transactionId });
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { _id: transactionId },
        {
          $set: {
            status: 'success',
            updated_at: expect.any(Date)
          }
        }
      );
      expect(result).toEqual(updatedTransaction);
    });

    it('should update status by transaction_id successfully', async () => {
      const transactionId = 'TRX-123456';
      const existingTransaction = {
        _id: new ObjectId(),
        transaction_id: transactionId,
        status: 'pending'
      };
      const updatedTransaction = {
        ...existingTransaction,
        status: 'success',
        updated_at: new Date()
      };

      mockCollection.findOne.mockResolvedValue(existingTransaction);
      mockCollection.updateOne.mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });
      mockCollection.findOne.mockResolvedValueOnce(existingTransaction).mockResolvedValueOnce(updatedTransaction);

      const result = await Transaction.updateStatus(transactionId, 'success');

      expect(mockCollection.findOne).toHaveBeenCalledWith({ transaction_id: transactionId });
      expect(mockCollection.updateOne).toHaveBeenCalledWith(
        { transaction_id: transactionId },
        {
          $set: {
            status: 'success',
            updated_at: expect.any(Date)
          }
        }
      );
      expect(result).toEqual(updatedTransaction);
    });

    it('should return existing transaction if already has target status', async () => {
      const transactionId = 'TRX-123456';
      const existingTransaction = {
        _id: new ObjectId(),
        transaction_id: transactionId,
        status: 'success'
      };

      mockCollection.findOne.mockResolvedValue(existingTransaction);

      const result = await Transaction.updateStatus(transactionId, 'success');

      expect(mockCollection.updateOne).not.toHaveBeenCalled();
      expect(result).toEqual(existingTransaction);
    });

    it('should throw error if transaction not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      await expect(Transaction.updateStatus('nonexistent', 'success')).rejects.toThrow('Transaction not found for status update');
    });    it('should handle invalid transaction_id that does not exist', async () => {
      mockCollection.findOne.mockResolvedValue(null);
      
      await expect(Transaction.updateStatus('invalid-objectid', 'success')).rejects.toThrow('Transaction not found for status update');
    });

    it('should handle database errors', async () => {
      mockCollection.findOne.mockRejectedValue(new Error('Database error'));

      await expect(Transaction.updateStatus('TRX-123', 'success')).rejects.toThrow('Database error');
    });
  });

  describe('findByUserId', () => {
    it('should find transactions by user id', async () => {
      const userId = new ObjectId();
      const mockTransactions = [
        { _id: new ObjectId(), user_id: userId, amount: 50000 },
        { _id: new ObjectId(), user_id: userId, amount: 25000 }
      ];

      mockCollection.toArray.mockResolvedValue(mockTransactions);

      const result = await Transaction.findByUserId(userId.toString());

      expect(mockCollection.find).toHaveBeenCalledWith({ user_id: userId });
      expect(mockCollection.sort).toHaveBeenCalledWith({ created_at: -1 });
      expect(result).toEqual(mockTransactions);
    });

    it('should return empty array if no transactions found', async () => {
      mockCollection.toArray.mockResolvedValue([]);

      const result = await Transaction.findByUserId(new ObjectId().toString());

      expect(result).toEqual([]);
    });
  });

  describe('findByUser', () => {
    it('should find transactions with type filter', async () => {
      const userId = new ObjectId();
      const mockTransactions = [
        { _id: new ObjectId(), user_id: userId, type: 'payment' }
      ];

      mockCollection.toArray.mockResolvedValue(mockTransactions);

      const result = await Transaction.findByUser(userId.toString(), { type: 'payment' });

      expect(mockCollection.find).toHaveBeenCalledWith({
        user_id: userId,
        type: 'payment'
      });
      expect(result).toEqual(mockTransactions);
    });

    it('should find transactions with $in type filter', async () => {
      const userId = new ObjectId();
      const options = { type: { $in: ['payment', 'top-up'] } };

      mockCollection.toArray.mockResolvedValue([]);

      await Transaction.findByUser(userId.toString(), options);

      expect(mockCollection.find).toHaveBeenCalledWith({
        user_id: userId,
        type: { $in: ['payment', 'top-up'] }
      });
    });

    it('should find transactions with status and limit', async () => {
      const userId = new ObjectId();
      const options = { status: 'success', limit: 5 };

      mockCollection.toArray.mockResolvedValue([]);

      await Transaction.findByUser(userId.toString(), options);

      expect(mockCollection.find).toHaveBeenCalledWith({
        user_id: userId,
        status: 'success'
      });
      expect(mockCollection.limit).toHaveBeenCalledWith(5);
    });
  });

  describe('findByBookingId', () => {
    it('should find transaction by booking id', async () => {
      const bookingId = new ObjectId();
      const mockTransaction = {
        _id: new ObjectId(),
        booking_id: bookingId,
        amount: 50000
      };

      mockCollection.findOne.mockResolvedValue(mockTransaction);

      const result = await Transaction.findByBookingId(bookingId.toString());

      expect(mockCollection.findOne).toHaveBeenCalledWith({ booking_id: bookingId });
      expect(result).toEqual(mockTransaction);
    });

    it('should return null if no transaction found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await Transaction.findByBookingId(new ObjectId().toString());

      expect(result).toBeNull();
    });
  });

  describe('findByBooking', () => {
    it('should be an alias for findByBookingId', async () => {
      const bookingId = new ObjectId();
      const mockTransaction = {
        _id: new ObjectId(),
        booking_id: bookingId
      };

      mockCollection.findOne.mockResolvedValue(mockTransaction);

      const result = await Transaction.findByBooking(bookingId.toString());

      expect(mockCollection.findOne).toHaveBeenCalledWith({ booking_id: bookingId });
      expect(result).toEqual(mockTransaction);
    });
  });

  describe('findByTransactionId', () => {
    beforeEach(() => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      console.log.mockRestore();
      console.error.mockRestore();
    });

    it('should find transaction by transaction_id', async () => {
      const transactionId = 'TRX-123456';
      const mockTransaction = {
        _id: new ObjectId(),
        transaction_id: transactionId,
        amount: 50000
      };

      mockCollection.findOne.mockResolvedValue(mockTransaction);

      const result = await Transaction.findByTransactionId(transactionId);

      expect(mockCollection.findOne).toHaveBeenCalledWith({ transaction_id: transactionId });
      expect(result).toEqual(mockTransaction);
    });

    it('should return null if transaction not found', async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await Transaction.findByTransactionId('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockCollection.findOne.mockRejectedValue(new Error('Database error'));

      await expect(Transaction.findByTransactionId('TRX-123')).rejects.toThrow('Database error');
    });
  });

  describe('findByStatus', () => {
    it('should find transactions by status', async () => {
      const mockTransactions = [
        { _id: new ObjectId(), status: 'success', amount: 50000 },
        { _id: new ObjectId(), status: 'success', amount: 25000 }
      ];

      mockCollection.toArray.mockResolvedValue(mockTransactions);

      const result = await Transaction.findByStatus('success');

      expect(mockCollection.find).toHaveBeenCalledWith({ status: 'success' });
      expect(mockCollection.sort).toHaveBeenCalledWith({ created_at: -1 });
      expect(result).toEqual(mockTransactions);
    });

    it('should return empty array if no transactions found', async () => {
      mockCollection.toArray.mockResolvedValue([]);

      const result = await Transaction.findByStatus('pending');

      expect(result).toEqual([]);
    });
  });

  describe('getUserBalance', () => {
    it('should calculate user balance correctly', async () => {
      const userId = new ObjectId();

      // Mock top-up aggregate result
      mockCollection.toArray
        .mockResolvedValueOnce([{ totalTopUp: 100000 }]) // First call for top-up
        .mockResolvedValueOnce([{ totalPayment: 30000 }]); // Second call for payment

      const result = await Transaction.getUserBalance(userId.toString());

      expect(mockCollection.aggregate).toHaveBeenCalledTimes(2);
      
      // Check top-up aggregation
      expect(mockCollection.aggregate).toHaveBeenNthCalledWith(1, [
        {
          $match: {
            user_id: userId,
            type: "top-up",
            status: "success",
          },
        },
        {
          $group: {
            _id: null,
            totalTopUp: { $sum: "$amount" },
          },
        },
      ]);

      // Check payment aggregation
      expect(mockCollection.aggregate).toHaveBeenNthCalledWith(2, [
        {
          $match: {
            user_id: userId,
            type: "payment",
            status: "success",
          },
        },
        {
          $group: {
            _id: null,
            totalPayment: { $sum: "$amount" },
          },
        },
      ]);

      expect(result).toBe(70000); // 100000 - 30000
    });

    it('should handle zero top-up and payment', async () => {
      const userId = new ObjectId();

      mockCollection.toArray
        .mockResolvedValueOnce([]) // No top-up
        .mockResolvedValueOnce([]); // No payment

      const result = await Transaction.getUserBalance(userId.toString());

      expect(result).toBe(0);
    });

    it('should handle only top-up transactions', async () => {
      const userId = new ObjectId();

      mockCollection.toArray
        .mockResolvedValueOnce([{ totalTopUp: 50000 }])
        .mockResolvedValueOnce([]);

      const result = await Transaction.getUserBalance(userId.toString());

      expect(result).toBe(50000);
    });

    it('should handle only payment transactions', async () => {
      const userId = new ObjectId();

      mockCollection.toArray
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ totalPayment: 25000 }]);

      const result = await Transaction.getUserBalance(userId.toString());

      expect(result).toBe(-25000);
    });

    it('should handle database errors', async () => {
      mockCollection.toArray.mockRejectedValue(new Error('Aggregation failed'));

      await expect(Transaction.getUserBalance(new ObjectId().toString())).rejects.toThrow('Aggregation failed');
    });
  });

  describe('Edge & Negative Case Extensions', () => {    it('should throw error if transactionId is not a valid ObjectId in findById', async () => {
      await expect(Transaction.findById('not-an-objectid')).rejects.toThrow('input must be a 24 character hex string');
    });

    it('should throw error if bookingId is not a valid ObjectId in findByBookingId', async () => {
      await expect(Transaction.findByBookingId('not-an-objectid')).rejects.toThrow('input must be a 24 character hex string');
    });

    it('should throw error if userId is not a valid ObjectId in findByUserId', async () => {
      await expect(Transaction.findByUserId('not-an-objectid')).rejects.toThrow('input must be a 24 character hex string');
    });

    it('should throw error if required fields are missing in create', async () => {
      await expect(Transaction.create({})).rejects.toThrow();
    });

    it('should throw error if amount is zero or negative in create', async () => {
      const transactionData = {
        user_id: new ObjectId().toString(),
        amount: 0,
        type: 'payment'
      };
      await expect(Transaction.create(transactionData)).rejects.toThrow();
      transactionData.amount = -1000;
      await expect(Transaction.create(transactionData)).rejects.toThrow();
    });

    it('should throw error if updateStatus is called with invalid status', async () => {
      mockCollection.findOne.mockResolvedValue({
        _id: new ObjectId(),
        transaction_id: 'TRX-123',
        status: 'pending'
      });
      mockCollection.updateOne.mockRejectedValue(new Error('Invalid status'));
      await expect(Transaction.updateStatus('TRX-123', 'not-a-status')).rejects.toThrow('Invalid status');
    });

    it('should throw error if findByUser is called with invalid filter', async () => {
      mockCollection.find.mockImplementation(() => { throw new Error('Invalid filter'); });
      await expect(Transaction.findByUser(new ObjectId().toString(), { type: 123 })).rejects.toThrow('Invalid filter');
    });
  });
});
