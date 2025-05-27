import { getDB } from '../config/db.js';

export class SaldoTransaction {
  static collection = 'saldoTransactions';

  /**
   * Setup indexes untuk collection
   */
  static async setupIndexes() {
    const db = getDB();
    await db.collection(this.collection).createIndex({ userId: 1 });
    await db.collection(this.collection).createIndex({ transactionId: 1 }, { unique: true });
    await db.collection(this.collection).createIndex({ status: 1 });
    await db.collection(this.collection).createIndex({ createdAt: 1 });
  }

  /**
   * Mencari transaksi berdasarkan ID
   * @param {string} id - ID transaksi
   * @returns {Promise<Object>} SaldoTransaction document
   */
  static async findById(id) {
    const db = getDB();
    return await db.collection(this.collection).findOne({ _id: id });
  }

  /**
   * Mencari transaksi berdasarkan ID transaksi
   * @param {string} transactionId - ID transaksi
   * @returns {Promise<Object>} SaldoTransaction document
   */
  static async findByTransactionId(transactionId) {
    const db = getDB();
    return await db.collection(this.collection).findOne({ transactionId });
  }

  /**
   * Mendapatkan riwayat transaksi user
   * @param {string} userId - ID user
   * @returns {Promise<Array>} Array of SaldoTransaction documents
   */
  static async getByUser(userId) {
    const db = getDB();
    return await db.collection(this.collection)
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
  }

  /**
   * Membuat transaksi saldo baru
   * @param {Object} transactionData - Data transaksi
   * @returns {Promise<Object>} SaldoTransaction document yang baru dibuat
   */
  static async create(transactionData) {
    const db = getDB();
    const {
      userId,
      type,
      amount,
      paymentMethod,
      status,
      transactionId,
      qrCodeUrl
    } = transactionData;

    const result = await db.collection(this.collection).insertOne({
      userId,
      type,
      amount,
      paymentMethod,
      status,
      transactionId,
      qrCodeUrl,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return {
      _id: result.insertedId,
      userId,
      type,
      amount,
      paymentMethod,
      status,
      transactionId,
      qrCodeUrl,
      createdAt: new Date()
    };
  }

  /**
   * Update status transaksi
   * @param {string} id - ID transaksi
   * @param {string} status - Status baru
   * @returns {Promise<Object>} Updated SaldoTransaction document
   */
  static async updateStatus(id, status) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: id },
      { 
        $set: {
          status,
          updatedAt: new Date()
        }
      },      { returnDocument: 'after' }
    );

    return result;
  }

  /**
   * Update status transaksi berdasarkan ID transaksi
   * @param {string} transactionId - ID transaksi
   * @param {string} status - Status baru
   * @returns {Promise<Object>} Updated SaldoTransaction document
   */
  static async updateStatusByTransactionId(transactionId, status) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { transactionId },
      { 
        $set: {
          status,
          updatedAt: new Date()
        }
      },      { returnDocument: 'after' }
    );

    return result;
  }

  /**
   * Mendapatkan total saldo masuk dan keluar user
   * @param {string} userId - ID user
   * @returns {Promise<Object>} Total saldo masuk dan keluar
   */
  static async getUserSaldoSummary(userId) {
    const db = getDB();
    const result = await db.collection(this.collection).aggregate([
      {
        $match: {
          userId,
          status: 'success'
        }
      },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' }
        }
      }
    ]).toArray();

    const summary = {
      credit: 0,
      debit: 0
    };

    result.forEach(item => {
      summary[item._id] = item.total;
    });

    return summary;
  }
} 