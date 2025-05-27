import { SaldoTransaction } from '../../../models/SaldoTransaction.js';
import { getDB } from '../../../config/db.js';

jest.mock('../../../config/db.js');

describe('SaldoTransaction Model', () => {
  let mockDb;
  let mockCollection;

  beforeEach(() => {
    mockCollection = {
      findOne: jest.fn(),
      find: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      toArray: jest.fn(),
      insertOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      createIndex: jest.fn(),
      aggregate: jest.fn().mockReturnThis()
    };
    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection)
    };
    getDB.mockReturnValue(mockDb);
    jest.clearAllMocks();
  });

  describe('setupIndexes', () => {
    it('should create indexes', async () => {
      mockCollection.createIndex.mockResolvedValue({});
      await SaldoTransaction.setupIndexes();
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ userId: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ transactionId: 1 }, { unique: true });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ status: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ createdAt: 1 });
    });
  });

  describe('findById', () => {
    it('should find transaction by ID', async () => {
      const id = 'trxid123';
      const mockTrx = { _id: id, amount: 10000 };
      mockCollection.findOne.mockResolvedValue(mockTrx);
      const result = await SaldoTransaction.findById(id);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: id });
      expect(result).toEqual(mockTrx);
    });
  });

  describe('findByTransactionId', () => {
    it('should find transaction by transactionId', async () => {
      const transactionId = 'trx-001';
      const mockTrx = { transactionId, amount: 20000 };
      mockCollection.findOne.mockResolvedValue(mockTrx);
      const result = await SaldoTransaction.findByTransactionId(transactionId);
      expect(mockCollection.findOne).toHaveBeenCalledWith({ transactionId });
      expect(result).toEqual(mockTrx);
    });
  });

  describe('getByUser', () => {
    it('should get transactions by user', async () => {
      const userId = 'user123';
      const mockTrxs = [{ _id: 'trx1', userId }, { _id: 'trx2', userId }];
      mockCollection.toArray.mockResolvedValue(mockTrxs);
      const result = await SaldoTransaction.getByUser(userId);
      expect(mockCollection.find).toHaveBeenCalledWith({ userId });
      expect(mockCollection.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(result).toEqual(mockTrxs);
    });
  });

  describe('create', () => {
    it('should create a saldo transaction', async () => {
      const trxData = {
        userId: 'user123',
        type: 'credit',
        amount: 10000,
        paymentMethod: 'bank',
        status: 'pending',
        transactionId: 'trx-001',
        qrCodeUrl: 'http://qr.com/abc'
      };
      const insertedId = 'trxid123';
      mockCollection.insertOne.mockResolvedValue({ insertedId });
      const result = await SaldoTransaction.create(trxData);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
        userId: trxData.userId,
        type: trxData.type,
        amount: trxData.amount,
        paymentMethod: trxData.paymentMethod,
        status: trxData.status,
        transactionId: trxData.transactionId,
        qrCodeUrl: trxData.qrCodeUrl,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      }));
      expect(result._id).toBe(insertedId);
    });
  });

  describe('updateStatus', () => {
    it('should update status by id', async () => {
      const id = 'trxid123';
      const status = 'success';
      const updatedTrx = { _id: id, status };
      mockCollection.findOneAndUpdate.mockResolvedValue({ value: updatedTrx });
      const result = await SaldoTransaction.updateStatus(id, status);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: id },
        { $set: { status, updatedAt: expect.any(Date) } },
        { returnDocument: 'after' }
      );
      expect(result).toEqual(updatedTrx);
    });
  });

  describe('updateStatusByTransactionId', () => {
    it('should update status by transactionId', async () => {
      const transactionId = 'trx-001';
      const status = 'failed';
      const updatedTrx = { transactionId, status };
      mockCollection.findOneAndUpdate.mockResolvedValue({ value: updatedTrx });
      const result = await SaldoTransaction.updateStatusByTransactionId(transactionId, status);
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { transactionId },
        { $set: { status, updatedAt: expect.any(Date) } },
        { returnDocument: 'after' }
      );
      expect(result).toEqual(updatedTrx);
    });
  });

  describe('getUserSaldoSummary', () => {
    it('should return user saldo summary', async () => {
      const userId = 'user123';
      const mockAggResult = [
        { _id: 'credit', total: 100000 },
        { _id: 'debit', total: 50000 }
      ];
      mockCollection.toArray.mockResolvedValue(mockAggResult);
      mockCollection.aggregate.mockReturnThis();
      const result = await SaldoTransaction.getUserSaldoSummary(userId);
      expect(mockCollection.aggregate).toHaveBeenCalled();
      expect(result).toEqual({ credit: 100000, debit: 50000 });
    });
    it('should return 0 if no transactions', async () => {
      const userId = 'user123';
      mockCollection.toArray.mockResolvedValue([]);
      mockCollection.aggregate.mockReturnThis();
      const result = await SaldoTransaction.getUserSaldoSummary(userId);
      expect(result).toEqual({ credit: 0, debit: 0 });
    });
  });
}); 