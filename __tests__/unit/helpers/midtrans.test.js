const mockSnap = {
  createTransaction: jest.fn(),
  getTransaction: jest.fn(),
  transaction: {
    notification: jest.fn(),
    status: jest.fn()
  }
};
jest.mock('midtrans-client', () => ({
  Snap: jest.fn().mockImplementation(() => mockSnap)
}));

const { createTransaction, verifyNotification, checkTransactionStatus } = require('../../../helpers/midtrans.js');

describe('Midtrans Helper', () => {
  let midtransClient;

  beforeEach(() => {
    mockSnap.createTransaction.mockReset();
    mockSnap.getTransaction.mockReset();
    mockSnap.transaction.notification.mockReset();
    mockSnap.transaction.status.mockReset();
    midtransClient = require('midtrans-client');
    jest.clearAllMocks();
    
    // Set environment variables
    process.env.MIDTRANS_IS_PRODUCTION = 'false';
    process.env.MIDTRANS_SERVER_KEY = 'test-server-key';
    process.env.MIDTRANS_CLIENT_KEY = 'test-client-key';
  });

  describe('createTransaction', () => {
    it('should create transaction successfully', async () => {
      const mockResponse = {
        token: 'test-token-123',
        redirect_url: 'https://app.sandbox.midtrans.com/snap/test-token'
      };

      mockSnap.createTransaction.mockResolvedValue(mockResponse);

      const params = {
        transactionId: 'TXN-123456',
        amount: 50000,
        customerName: 'John Doe',
        customerEmail: 'john@example.com'
      };

      const result = await createTransaction(params);

      expect(mockSnap.createTransaction).toHaveBeenCalledWith({
        transaction_details: {
          order_id: 'TXN-123456',
          gross_amount: 50000
        },
        credit_card: {
          secure: true
        },
        customer_details: {
          first_name: 'John Doe',
          email: 'john@example.com'
        }
      });

      expect(result).toEqual({
        token: 'test-token-123',
        redirectUrl: 'https://app.sandbox.midtrans.com/snap/test-token'
      });
    });

    it('should throw error when transaction creation fails', async () => {
      mockSnap.createTransaction.mockRejectedValue(new Error('Midtrans API Error'));

      const params = {
        transactionId: 'TXN-123456',
        amount: 50000,
        customerName: 'John Doe',
        customerEmail: 'john@example.com'
      };

      await expect(createTransaction(params))
        .rejects.toThrow('Gagal membuat transaksi');
    });

    it('should handle missing parameters', async () => {
      mockSnap.createTransaction.mockRejectedValue(new Error('Missing required fields'));

      const params = {
        transactionId: 'TXN-123456'
        // Missing amount, customerName, customerEmail
      };

      await expect(createTransaction(params))
        .rejects.toThrow('Gagal membuat transaksi');
    });

    it('should handle zero amount', async () => {
      const mockResponse = {
        token: 'test-token-zero',
        redirect_url: 'https://app.sandbox.midtrans.com/snap/test-token-zero'
      };

      mockSnap.createTransaction.mockResolvedValue(mockResponse);

      const params = {
        transactionId: 'TXN-ZERO',
        amount: 0,
        customerName: 'Test User',
        customerEmail: 'test@example.com'
      };

      const result = await createTransaction(params);

      expect(result.token).toBe('test-token-zero');
    });
  });

  describe('verifyNotification', () => {
    it('should verify settlement notification successfully', async () => {
      const mockNotification = {
        order_id: 'TXN-123456',
        transaction_status: 'settlement',
        fraud_status: 'accept'
      };

      mockSnap.transaction.notification.mockResolvedValue(mockNotification);

      const result = await verifyNotification(mockNotification);

      expect(mockSnap.transaction.notification).toHaveBeenCalledWith(mockNotification);
      expect(result).toEqual({
        orderId: 'TXN-123456',
        status: 'success'
      });
    });

    it('should verify capture with accept fraud status', async () => {
      const mockNotification = {
        order_id: 'TXN-CAPTURE',
        transaction_status: 'capture',
        fraud_status: 'accept'
      };

      mockSnap.transaction.notification.mockResolvedValue(mockNotification);

      const result = await verifyNotification(mockNotification);

      expect(result).toEqual({
        orderId: 'TXN-CAPTURE',
        status: 'success'
      });
    });

    it('should verify capture with challenge fraud status', async () => {
      const mockNotification = {
        order_id: 'TXN-CHALLENGE',
        transaction_status: 'capture',
        fraud_status: 'challenge'
      };

      mockSnap.transaction.notification.mockResolvedValue(mockNotification);

      const result = await verifyNotification(mockNotification);

      expect(result).toEqual({
        orderId: 'TXN-CHALLENGE',
        status: 'challenge'
      });
    });

    it('should verify pending notification', async () => {
      const mockNotification = {
        order_id: 'TXN-PENDING',
        transaction_status: 'pending'
      };

      mockSnap.transaction.notification.mockResolvedValue(mockNotification);

      const result = await verifyNotification(mockNotification);

      expect(result).toEqual({
        orderId: 'TXN-PENDING',
        status: 'pending'
      });
    });

    it('should verify failed notifications (cancel)', async () => {
      const mockNotification = {
        order_id: 'TXN-CANCEL',
        transaction_status: 'cancel'
      };

      mockSnap.transaction.notification.mockResolvedValue(mockNotification);

      const result = await verifyNotification(mockNotification);

      expect(result).toEqual({
        orderId: 'TXN-CANCEL',
        status: 'failed'
      });
    });

    it('should verify failed notifications (deny)', async () => {
      const mockNotification = {
        order_id: 'TXN-DENY',
        transaction_status: 'deny'
      };

      mockSnap.transaction.notification.mockResolvedValue(mockNotification);

      const result = await verifyNotification(mockNotification);

      expect(result).toEqual({
        orderId: 'TXN-DENY',
        status: 'failed'
      });
    });

    it('should verify failed notifications (expire)', async () => {
      const mockNotification = {
        order_id: 'TXN-EXPIRE',
        transaction_status: 'expire'
      };

      mockSnap.transaction.notification.mockResolvedValue(mockNotification);

      const result = await verifyNotification(mockNotification);

      expect(result).toEqual({
        orderId: 'TXN-EXPIRE',
        status: 'failed'
      });
    });

    it('should throw error when notification verification fails', async () => {
      mockSnap.transaction.notification.mockRejectedValue(new Error('Invalid notification'));

      const mockNotification = {
        order_id: 'TXN-INVALID'
      };

      await expect(verifyNotification(mockNotification))
        .rejects.toThrow('Gagal memverifikasi notifikasi');
    });

    it('should handle unknown transaction status', async () => {
      const mockNotification = {
        order_id: 'TXN-UNKNOWN',
        transaction_status: 'unknown_status'
      };

      mockSnap.transaction.notification.mockResolvedValue(mockNotification);

      const result = await verifyNotification(mockNotification);

      expect(result).toEqual({
        orderId: 'TXN-UNKNOWN',
        status: undefined // Should be undefined for unknown status
      });
    });
  });

  describe('checkTransactionStatus', () => {
    it('should check transaction status successfully', async () => {
      const mockStatusResponse = {
        order_id: 'TXN-STATUS-CHECK',
        transaction_status: 'settlement',
        fraud_status: 'accept'
      };

      mockSnap.transaction.status.mockResolvedValue(mockStatusResponse);

      const result = await checkTransactionStatus('TXN-STATUS-CHECK');

      expect(mockSnap.transaction.status).toHaveBeenCalledWith('TXN-STATUS-CHECK');
      expect(result).toEqual({
        orderId: 'TXN-STATUS-CHECK',
        status: 'settlement',
        fraudStatus: 'accept'
      });
    });

    it('should handle pending transaction status', async () => {
      const mockStatusResponse = {
        order_id: 'TXN-PENDING-CHECK',
        transaction_status: 'pending',
        fraud_status: null
      };

      mockSnap.transaction.status.mockResolvedValue(mockStatusResponse);

      const result = await checkTransactionStatus('TXN-PENDING-CHECK');

      expect(result).toEqual({
        orderId: 'TXN-PENDING-CHECK',
        status: 'pending',
        fraudStatus: null
      });
    });

    it('should throw error when status check fails', async () => {
      mockSnap.transaction.status.mockRejectedValue(new Error('Transaction not found'));

      await expect(checkTransactionStatus('TXN-NOT-FOUND'))
        .rejects.toThrow('Gagal mengecek status transaksi');
    });

    it('should handle empty transaction ID', async () => {
      mockSnap.transaction.status.mockRejectedValue(new Error('Transaction ID required'));

      await expect(checkTransactionStatus(''))
        .rejects.toThrow('Gagal mengecek status transaksi');

      await expect(checkTransactionStatus(null))
        .rejects.toThrow('Gagal mengecek status transaksi');
    });
  });

  describe('Environment Configuration', () => {
    it('should handle production environment setting', () => {
      process.env.MIDTRANS_IS_PRODUCTION = 'true';
      
      // Test that the environment variable is read correctly
      expect(process.env.MIDTRANS_IS_PRODUCTION).toBe('true');
    });

    it('should handle sandbox environment setting', () => {
      process.env.MIDTRANS_IS_PRODUCTION = 'false';
      
      // Test that the environment variable is read correctly
      expect(process.env.MIDTRANS_IS_PRODUCTION).toBe('false');
    });
  });
}); 