import { Model } from 'mongoloquent';

export class SaldoTransaction extends Model {
  static collectionName = 'saldo_transactions';
  
  static schema = {
    userId: { type: 'objectId', ref: 'users', required: true },
    amount: { type: 'number', required: true }, // Positive for top-up, negative for deduction
    type: { 
      type: 'string',
      enum: ['top-up', 'deduction'],
      required: true
    },
    transactionId: { type: 'string', required: true, unique: true },
    status: { 
      type: 'string',
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    createdAt: { type: 'date', default: Date.now }
  };

  // Create indexes
  static async createIndexes() {
    await this.collection.createIndex({ userId: 1 });
    await this.collection.createIndex({ transactionId: 1 }, { unique: true });
    await this.collection.createIndex({ createdAt: 1 });
  }

  // Create top-up transaction
  static async createTopUp(userId, amount, transactionId) {
    if (amount <= 0) throw new Error('Jumlah top-up harus lebih dari 0');

    return await this.create({
      userId,
      amount,
      type: 'top-up',
      transactionId,
      status: 'pending'
    });
  }

  // Create deduction transaction
  static async createDeduction(userId, amount, description = 'Pembayaran parkir') {
    if (amount <= 0) throw new Error('Jumlah deduction harus lebih dari 0');

    const transactionId = 'DED_' + Date.now() + '_' + userId;

    return await this.create({
      userId,
      amount: -amount, // Store as negative for deductions
      type: 'deduction',
      transactionId,
      status: 'completed' // Deductions are always completed immediately
    });
  }

  // Complete top-up transaction (e.g., from Midtrans webhook)
  static async completeTopUp(transactionId) {
    const transaction = await this.findOne({ transactionId });
    if (!transaction) throw new Error('Transaksi tidak ditemukan');

    if (transaction.status !== 'pending') {
      throw new Error('Status transaksi tidak valid');
    }

    // Update user's saldo
    await this.model('User').addSaldo(transaction.userId, transaction.amount);

    // Update transaction status
    return await this.findOneAndUpdate(
      { transactionId },
      { status: 'completed' },
      { new: true }
    );
  }

  // Get user's transaction history
  static async getUserTransactions(userId) {
    return await this.find({ userId }).sort({ createdAt: -1 });
  }

  // Get transaction by ID
  static async getByTransactionId(transactionId) {
    return await this.findOne({ transactionId });
  }
} 