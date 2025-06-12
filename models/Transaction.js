import { getDB } from "../config/db.js";
import { ObjectId } from "mongodb";

export class Transaction {
  static collection = "transactions";

  /**
   * Setup indexes untuk collection
   */ static async setupIndexes() {
    const db = getDB();
    await Promise.all([
      db.collection(this.collection).createIndex({ user_id: 1 }),
      db.collection(this.collection).createIndex({ booking_id: 1 }),
      db.collection(this.collection).createIndex({ status: 1 }),
      db.collection(this.collection).createIndex({ type: 1 }),
      db.collection(this.collection).createIndex({ created_at: 1 }),
      db.collection(this.collection).createIndex({ transaction_id: 1 }),
    ]);
  }

  /**
   * Mencari transaksi berdasarkan ID
   * @param {string} id - ID transaksi
   * @returns {Promise<Object>} Transaction document
   */
  static async findById(id) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .findOne({ _id: new ObjectId(id) });
  }

  /**
   * Membuat transaksi baru
   * @param {Object} transactionData - Data transaksi
   * @returns {Promise<Object>} Transaction document yang baru dibuat
   */
  static async create(transactionData) {
    const db = getDB();

    const transaction = {
      user_id: new ObjectId(transactionData.user_id),
      booking_id: transactionData.booking_id
        ? new ObjectId(transactionData.booking_id)
        : null,
      amount: transactionData.amount,
      type: transactionData.type, // 'payment', 'top-up'
      payment_method: transactionData.payment_method || "manual",
      status: transactionData.status || "pending",
      transaction_id: transactionData.transaction_id || `TRX-${Date.now()}`,
      qr_code_url: transactionData.qr_code_url || null,
      description: transactionData.description || "",
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await db.collection(this.collection).insertOne(transaction);
    return { _id: result.insertedId, ...transaction };
  }

  /**
   * Update status transaksi
   * @param {string} id - ID transaksi
   * @param {string} status - Status baru
   * @returns {Promise<Object>} Updated transaction document
   */
  static async updateStatus(id, status) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updated_at: new Date(),
        },
      },
      { returnDocument: "after" }
    );
    return result;
  }

  // Enhanced method untuk update status dengan logging - use transaction_id field instead of _id
  static async updateStatus(transactionId, newStatus) {
    try {
      console.log(
        `🔄 Updating transaction ${transactionId} status to: ${newStatus}`
      );

      // Check if transactionId looks like an ObjectId (24 hex chars) or a transaction_id string
      let searchQuery;

      if (
        typeof transactionId === "string" &&
        transactionId.length === 24 &&
        /^[0-9a-fA-F]{24}$/.test(transactionId)
      ) {
        // This is an ObjectId string
        try {
          const objectId = new ObjectId(transactionId);
          searchQuery = { _id: objectId };
          console.log(`✅ Using _id search with ObjectId: ${objectId}`);
        } catch (conversionError) {
          console.error(
            `❌ Invalid ObjectId format: ${transactionId}`,
            conversionError
          );
          throw new Error(`Invalid transaction ID format: ${transactionId}`);
        }
      } else {
        // This is a transaction_id string (like TOPUP-1748849575223)
        searchQuery = { transaction_id: transactionId };
        console.log(
          `✅ Using transaction_id search with string: ${transactionId}`
        );
      }

      const db = getDB();
      // First, let's check if the document exists
      const existingTransaction = await db
        .collection("transactions")
        .findOne(searchQuery);

      if (!existingTransaction) {
        console.error(
          `❌ Transaction not found in database with query:`,
          searchQuery
        );
        throw new Error("Transaction not found for status update");
      } else {
        console.log(`✅ Transaction found in database:`, {
          _id: existingTransaction._id,
          transaction_id: existingTransaction.transaction_id,
          current_status: existingTransaction.status,
        });
      }

      // Check if already updated to avoid duplicate updates
      if (existingTransaction.status === newStatus) {
        console.log(
          `🔄 Transaction already has status ${newStatus}, skipping update`
        );
        return existingTransaction;
      }

      // Try direct update with updateOne - more reliable than findOneAndUpdate
      console.log(
        `🔄 Updating transaction status from ${existingTransaction.status} to ${newStatus}`
      );
      const updateResult = await db
        .collection("transactions")
        .updateOne(searchQuery, {
          $set: {
            status: newStatus,
            updated_at: new Date(),
          },
        });

      console.log(`🔍 Update result:`, updateResult);

      if (updateResult.modifiedCount > 0) {
        // Fetch the updated document
        const updatedDoc = await db
          .collection("transactions")
          .findOne(searchQuery);
        console.log(
          `✅ Transaction status updated successfully: ${transactionId} -> ${newStatus}`
        );
        return updatedDoc;
      } else if (updateResult.matchedCount > 0) {
        // Document was matched but not modified (probably already had the same status)
        const currentDoc = await db
          .collection("transactions")
          .findOne(searchQuery);
        console.log(`🔄 Transaction already had status ${currentDoc.status}`);
        return currentDoc;
      } else {
        throw new Error("Transaction not found for status update");
      }
    } catch (error) {
      console.error("❌ Error updating transaction status:", error);
      throw error;
    }
  }

  /**
   * Mencari transaksi berdasarkan user ID
   * @param {string} userId - ID user
   * @returns {Promise<Array>} Array of transaction documents
   */
  static async findByUserId(userId) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .find({ user_id: new ObjectId(userId) })
      .sort({ created_at: -1 })
      .toArray();
  }
  /**
   * Mencari transaksi berdasarkan user ID dengan filter
   * @param {string} userId - ID user
   * @param {Object} options - Filter options (type, status, limit)
   * @returns {Promise<Array>} Array of transaction documents
   */
  static async findByUser(userId, options = {}) {
    const db = getDB();
    const query = { user_id: new ObjectId(userId) };

    if (options.type) {
      if (typeof options.type === "object" && options.type.$in) {
        // Handle MongoDB style query with $in operator
        query.type = { $in: options.type.$in };
      } else {
        // Simple string match
        query.type = options.type;
      }
    }

    if (options.status) query.status = options.status;

    let cursor = db
      .collection(this.collection)
      .find(query)
      .sort({ created_at: -1 });

    if (options.limit) cursor = cursor.limit(options.limit);

    return await cursor.toArray();
  }

  /**
   * Mencari transaksi berdasarkan booking ID
   * @param {string} bookingId - ID booking
   * @returns {Promise<Object>} Transaction document
   */
  static async findByBookingId(bookingId) {
    const db = getDB();
    return await db.collection(this.collection).findOne({
      booking_id: new ObjectId(bookingId),
    });
  }

  /**
   * Mencari transaksi berdasarkan booking ID (alias for findByBookingId)
   * @param {string} bookingId - ID booking
   * @returns {Promise<Object>} Transaction document
   */
  static async findByBooking(bookingId) {
    return this.findByBookingId(bookingId);
  }

  /**
   * Mencari transaksi berdasarkan transaction_id
   * @param {string} transactionId - ID transaksi
   * @returns {Promise<Object>} Transaction document
   */
  static async findByTransactionId(transactionId) {
    try {
      console.log(`🔍 Finding transaction by ID: ${transactionId}`);

      const db = getDB();
      const transaction = await db
        .collection("transactions")
        .findOne({ transaction_id: transactionId });

      if (transaction) {
        console.log(`✅ Transaction found: ${transactionId}`);
      } else {
        console.log(`❌ Transaction not found: ${transactionId}`);
      }

      return transaction;
    } catch (error) {
      console.error("❌ Error finding transaction by ID:", error);
      throw error;
    }
  }

  /**
   * Mencari transaksi berdasarkan status
   * @param {string} status - Status transaksi
   * @returns {Promise<Array>} Array of transaction documents
   */
  static async findByStatus(status) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .find({ status })
      .sort({ created_at: -1 })
      .toArray();
  }

  /**
   * Mendapatkan total saldo user dari transaksi top-up yang sukses
   * @param {string} userId - ID user
   * @returns {Promise<Number>} Total amount
   */
  static async getUserBalance(userId) {
    const db = getDB();
    const result = await db
      .collection(this.collection)
      .aggregate([
        {
          $match: {
            user_id: new ObjectId(userId),
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
      ])
      .toArray();

    const topUpTotal = result.length > 0 ? result[0].totalTopUp : 0;

    // Kurangi dengan total payment yang sukses
    const paymentResult = await db
      .collection(this.collection)
      .aggregate([
        {
          $match: {
            user_id: new ObjectId(userId),
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
      ])
      .toArray();

    const paymentTotal =
      paymentResult.length > 0 ? paymentResult[0].totalPayment : 0;

    return topUpTotal - paymentTotal;
  }
}
