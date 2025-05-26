import { getDB } from '../config/db.js';

export class Payment {
  static collection = 'payments';

  /**
   * Setup indexes untuk collection
   */
  static async setupIndexes() {
    const db = getDB();
    await db.collection(this.collection).createIndex({ bookingId: 1 }, { unique: true });
    await db.collection(this.collection).createIndex({ transactionId: 1 }, { unique: true });
    await db.collection(this.collection).createIndex({ status: 1 });
    await db.collection(this.collection).createIndex({ createdAt: 1 });
  }

  /**
   * Mencari pembayaran berdasarkan ID
   * @param {string} id - ID pembayaran
   * @returns {Promise<Object>} Payment document
   */
  static async findById(id) {
    const db = getDB();
    return await db.collection(this.collection).findOne({ _id: id });
  }

  /**
   * Mencari pembayaran berdasarkan ID transaksi
   * @param {string} transactionId - ID transaksi
   * @returns {Promise<Object>} Payment document
   */
  static async findByTransactionId(transactionId) {
    const db = getDB();
    return await db.collection(this.collection).findOne({ transactionId });
  }

  /**
   * Mendapatkan pembayaran untuk booking tertentu
   * @param {string} bookingId - ID booking
   * @returns {Promise<Object>} Payment document
   */
  static async getByBooking(bookingId) {
    const db = getDB();
    return await db.collection(this.collection).findOne({ bookingId });
  }

  /**
   * Mendapatkan riwayat pembayaran user
   * @param {string} userId - ID user
   * @returns {Promise<Array>} Array of Payment documents
   */
  static async getByUser(userId) {
    const db = getDB();
    const bookings = await db.collection('bookings')
      .find({ userId })
      .project({ _id: 1 })
      .toArray();

    const bookingIds = bookings.map(booking => booking._id);

    return await db.collection(this.collection)
      .find({ bookingId: { $in: bookingIds } })
      .sort({ createdAt: -1 })
      .toArray();
  }

  /**
   * Membuat pembayaran baru
   * @param {Object} paymentData - Data pembayaran
   * @returns {Promise<Object>} Payment document yang baru dibuat
   */
  static async create(paymentData) {
    const db = getDB();
    const {
      bookingId,
      transactionId,
      paymentMethod,
      amount,
      status,
      qrCodeUrl
    } = paymentData;

    const result = await db.collection(this.collection).insertOne({
      bookingId,
      transactionId,
      paymentMethod,
      amount,
      status,
      qrCodeUrl,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return {
      _id: result.insertedId,
      bookingId,
      transactionId,
      paymentMethod,
      amount,
      status,
      qrCodeUrl,
      createdAt: new Date()
    };
  }

  /**
   * Update status pembayaran
   * @param {string} id - ID pembayaran
   * @param {string} status - Status baru
   * @returns {Promise<Object>} Updated Payment document
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
      },
      { returnDocument: 'after' }
    );

    return result.value;
  }

  /**
   * Update status pembayaran berdasarkan ID transaksi
   * @param {string} transactionId - ID transaksi
   * @param {string} status - Status baru
   * @returns {Promise<Object>} Updated Payment document
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
      },
      { returnDocument: 'after' }
    );

    return result.value;
  }
} 