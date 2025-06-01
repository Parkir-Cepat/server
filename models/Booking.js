import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import {
  generateBookingQR,
  generateEntryQRToken,
  generateExitQRToken,
  verifyQRToken,
} from "../helpers/qrcode.js";

export class Booking {
  static collection = "bookings";

  /**
   * Setup indexes untuk collection
   */
  static async setupIndexes() {
    const db = getDB();
    await Promise.all([
      db.collection(this.collection).createIndex({ user_id: 1 }),
      db.collection(this.collection).createIndex({ parking_id: 1 }),
      db.collection(this.collection).createIndex({ status: 1 }),
      db.collection(this.collection).createIndex({ start_time: 1 }),
      db.collection(this.collection).createIndex({ created_at: 1 }),
    ]);
  }

  /**
   * Mencari booking berdasarkan ID
   * @param {string} id - ID booking
   * @returns {Promise<Object>} Booking document
   */
  static async findById(id) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .findOne({ _id: new ObjectId(id) });
  }

  /**
   * Membuat booking baru (tanpa payment)
   * @param {Object} bookingData - Data booking
   * @returns {Promise<Object>} Booking document yang baru dibuat
   */
  static async create(bookingData) {
    const db = getDB();
    const { user_id, parking_id, vehicle_type, start_time, duration } =
      bookingData;

    // Dapatkan detail parkir
    const parking = await db.collection("parkings").findOne({
      _id: new ObjectId(parking_id),
    });

    if (!parking) {
      throw new Error("Tempat parkir tidak ditemukan");
    }

    // Check availability for specific vehicle type
    const availableSlots = parking.available?.[vehicle_type] || 0;
    const totalCapacity = parking.capacity?.[vehicle_type] || 0;

    if (availableSlots <= 0) {
      throw new Error(
        `Slot parkir ${vehicle_type} tidak tersedia. Available: ${availableSlots}, Capacity: ${totalCapacity}`
      );
    }

    // Calculate cost based on parking rates and duration
    const pricePerHour = parking.rates?.[vehicle_type];
    if (!pricePerHour) {
      throw new Error(`Harga untuk ${vehicle_type} tidak tersedia`);
    }

    const totalCost = pricePerHour * duration;

    // Check if there are enough slots (don't reserve yet)
    const currentActiveBookings = await db
      .collection(this.collection)
      .countDocuments({
        parking_id: new ObjectId(parking_id),
        vehicle_type: vehicle_type,
        status: { $in: ["confirmed", "active"] }, // Only count paid bookings
      });

    if (currentActiveBookings >= totalCapacity) {
      throw new Error(
        `Slot parkir ${vehicle_type} sudah penuh. Active bookings: ${currentActiveBookings}, Capacity: ${totalCapacity}`
      );
    }

    const booking = {
      user_id: new ObjectId(user_id),
      parking_id: new ObjectId(parking_id),
      vehicle_type: vehicle_type,
      start_time: new Date(start_time),
      duration,
      cost: totalCost,
      status: "pending", // Always pending until payment
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await db.collection(this.collection).insertOne(booking);

    // DON'T reserve slot yet - only after payment
    console.log(
      `✅ Booking created with pending status - no slot reserved yet`
    );

    return { _id: result.insertedId, ...booking };
  }

  /**
   * Process payment for booking
   * @param {string} bookingId - Booking ID
   * @param {string} userId - User ID (for security)
   * @returns {Promise<Object>} Updated booking
   */
  static async processPayment(bookingId, userId) {
    const db = getDB();

    // Get booking details
    const booking = await this.findById(bookingId);
    if (!booking) {
      throw new Error("Booking tidak ditemukan");
    }

    if (booking.user_id.toString() !== userId) {
      throw new Error("Unauthorized - booking tidak milik user ini");
    }

    if (booking.status !== "pending") {
      throw new Error("Booking sudah dibayar atau dibatalkan");
    }

    // Get user details
    const user = await db.collection("users").findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      throw new Error("User tidak ditemukan");
    }

    // Check if user has enough balance
    if (user.saldo < booking.cost) {
      throw new Error(
        `Saldo tidak cukup. Saldo: Rp ${user.saldo.toLocaleString()}, Dibutuhkan: Rp ${booking.cost.toLocaleString()}`
      );
    }

    // Check slot availability again (double check)
    const parking = await db.collection("parkings").findOne({
      _id: booking.parking_id,
    });

    const availableSlots = parking.available?.[booking.vehicle_type] || 0;
    if (availableSlots <= 0) {
      throw new Error(
        `Slot parkir ${booking.vehicle_type} sudah tidak tersedia`
      );
    }

    // Start transaction for payment
    const session = db.client.startSession();

    try {
      await session.withTransaction(async () => {
        // Deduct user balance
        await db
          .collection("users")
          .updateOne(
            { _id: new ObjectId(userId) },
            { $inc: { saldo: -booking.cost } },
            { session }
          );

        // Reserve parking slot
        await db
          .collection("parkings")
          .updateOne(
            { _id: booking.parking_id },
            { $inc: { [`available.${booking.vehicle_type}`]: -1 } },
            { session }
          );

        // Update booking status to confirmed
        await db.collection(this.collection).updateOne(
          { _id: new ObjectId(bookingId) },
          {
            $set: {
              status: "confirmed",
              updated_at: new Date(),
            },
          },
          { session }
        );
      });

      console.log(`✅ Payment processed for booking ${bookingId}`);
      console.log(
        `💰 User balance deducted: Rp ${booking.cost.toLocaleString()}`
      );
      console.log(`🚗 Parking slot reserved for ${booking.vehicle_type}`);

      return await this.findById(bookingId);
    } finally {
      await session.endSession();
    }
  }

  static async updateStatus(id, status) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    return result;
  }

  static async getActiveBookings(userId) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .find({
        user_id: new ObjectId(userId), // Changed from userId to user_id
        status: { $in: ["pending", "confirmed"] },
      })
      .sort({ start_time: -1 }) // Changed from startTime to start_time
      .toArray();
  }

  static async getBookingHistory(userId) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .find({
        user_id: new ObjectId(userId), // Changed from userId to user_id
        status: { $in: ["completed", "cancelled"] },
      })
      .sort({ start_time: -1 }) // Changed from startTime to start_time
      .toArray();
  }

  static async setupIndexes() {
    const db = getDB();
    await Promise.all([
      db.collection(this.collection).createIndex({ user_id: 1 }), // Changed from userId to user_id
      db.collection(this.collection).createIndex({ parking_id: 1 }), // Changed from parkingLotId to parking_id
      db.collection(this.collection).createIndex({ status: 1 }),
      db.collection(this.collection).createIndex({ start_time: 1 }), // Changed from startTime to start_time
      db.collection(this.collection).createIndex({ created_at: 1 }),
    ]);
  }

  static async extend(id, additionalDuration, additionalCost) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $inc: {
          duration: additionalDuration,
          cost: additionalCost,
        },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: "after" }
    );

    return result;
  }

  static async getExpiredBookings() {
    const db = getDB();
    const now = new Date();

    return await db
      .collection(this.collection)
      .find({
        status: { $in: ["pending", "confirmed"] },
        $expr: {
          $lt: [
            {
              $add: [
                "$start_time", // Changed from $startTime to $start_time
                { $multiply: ["$duration", 60 * 60 * 1000] },
              ],
            },
            now,
          ],
        },
      })
      .toArray();
  }

  static async generateQRCode(id) {
    const db = getDB();
    const booking = await this.findById(id);

    if (!booking) {
      throw new Error("Booking tidak ditemukan");
    }

    if (booking.status !== "confirmed") {
      throw new Error(
        "QR Code hanya bisa dibuat untuk booking yang sudah dikonfirmasi"
      );
    }

    // Generate QR code
    const qrCode = await generateBookingQR(booking);

    // Update booking dengan QR code
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          qrCode,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    return result;
  }

  /**
   * Generate Entry QR Code
   * @param {string} bookingId - Booking ID
   * @returns {Promise<Object>} QR Response with entry QR
   */
  static async generateEntryQR(bookingId) {
    const db = getDB();
    const booking = await this.findById(bookingId);

    if (!booking) {
      throw new Error("Booking tidak ditemukan");
    }

    if (booking.status !== "confirmed") {
      throw new Error(
        "Entry QR hanya bisa dibuat untuk booking yang sudah confirmed"
      );
    }

    // Check if QR already exists and still valid
    if (booking.entry_qr) {
      try {
        const decoded = verifyQRToken(booking.entry_qr);
        if (decoded && new Date(decoded.expiresAt) > new Date()) {
          return {
            qrCode: booking.entry_qr,
            qrType: "entry",
            expiresAt: decoded.expiresAt,
            instructions: "Scan QR code ini di gate masuk parkir",
            booking: booking,
          };
        }
      } catch (error) {
        // QR expired or invalid, generate new one
      }
    }

    // Generate new entry QR (expires in 24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const qrCode = await generateEntryQRToken({
      bookingId: bookingId,
      parkingId: booking.parking_id.toString(),
      vehicleType: booking.vehicle_type,
      expiresAt: expiresAt.toISOString(),
    });

    // Update booking dengan entry QR
    await db.collection(this.collection).updateOne(
      { _id: new ObjectId(bookingId) },
      {
        $set: {
          entry_qr: qrCode,
          updated_at: new Date(),
        },
      }
    );

    return {
      qrCode: qrCode,
      qrType: "entry",
      expiresAt: expiresAt.toISOString(),
      instructions:
        "Scan QR code ini di gate masuk parkir. QR berlaku selama 24 jam.",
      booking: await this.findById(bookingId),
    };
  }

  /**
   * Generate Exit QR Code
   * @param {string} bookingId - Booking ID
   * @returns {Promise<Object>} QR Response with exit QR
   */
  static async generateExitQR(bookingId) {
    const db = getDB();
    const booking = await this.findById(bookingId);

    if (!booking) {
      throw new Error("Booking tidak ditemukan");
    }

    if (booking.status !== "active") {
      throw new Error(
        "Exit QR hanya bisa dibuat untuk booking yang sedang aktif"
      );
    }

    // Generate exit QR (expires in 2 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    const qrCode = await generateExitQRToken({
      bookingId: bookingId,
      parkingId: booking.parking_id.toString(),
      vehicleType: booking.vehicle_type,
      expiresAt: expiresAt.toISOString(),
    });

    // Update booking dengan exit QR
    await db.collection(this.collection).updateOne(
      { _id: new ObjectId(bookingId) },
      {
        $set: {
          exit_qr: qrCode,
          updated_at: new Date(),
        },
      }
    );

    return {
      qrCode: qrCode,
      qrType: "exit",
      expiresAt: expiresAt.toISOString(),
      instructions:
        "Scan QR code ini di gate keluar parkir. QR berlaku selama 2 jam.",
      booking: await this.findById(bookingId),
    };
  }

  /**
   * Scan Entry QR Code
   * @param {string} qrCode - QR Code string
   * @param {string} userId - User ID for verification
   * @returns {Promise<Object>} Booking response
   */
  static async scanEntryQR(qrCode, userId) {
    const db = getDB();

    try {
      // Verify QR token
      const decoded = verifyQRToken(qrCode);

      if (!decoded || decoded.type !== "entry") {
        throw new Error("QR Code tidak valid untuk entry");
      }

      // Check expiration
      if (new Date(decoded.expiresAt) < new Date()) {
        throw new Error("QR Code sudah expired");
      }

      const booking = await this.findById(decoded.bookingId);
      if (!booking) {
        throw new Error("Booking tidak ditemukan");
      }

      // Verify user ownership
      if (booking.user_id.toString() !== userId) {
        throw new Error("QR Code tidak milik user ini");
      }

      // Check booking status
      if (booking.status !== "confirmed") {
        throw new Error("Booking harus dalam status confirmed untuk entry");
      }

      // Update booking status to active
      const result = await db.collection(this.collection).findOneAndUpdate(
        { _id: new ObjectId(decoded.bookingId) },
        {
          $set: {
            status: "active",
            actual_entry_time: new Date(),
            updated_at: new Date(),
          },
        },
        { returnDocument: "after" }
      );

      return {
        booking: result,
        message: "Entry berhasil! Booking sekarang aktif.",
        success: true,
      };
    } catch (error) {
      throw new Error(`Scan entry gagal: ${error.message}`);
    }
  }

  /**
   * Scan Exit QR Code
   * @param {string} qrCode - QR Code string
   * @param {string} userId - User ID for verification
   * @returns {Promise<Object>} Booking response
   */
  static async scanExitQR(qrCode, userId) {
    const db = getDB();

    try {
      // Verify QR token
      const decoded = verifyQRToken(qrCode);

      if (!decoded || decoded.type !== "exit") {
        throw new Error("QR Code tidak valid untuk exit");
      }

      // Check expiration
      if (new Date(decoded.expiresAt) < new Date()) {
        throw new Error("QR Code sudah expired");
      }

      const booking = await this.findById(decoded.bookingId);
      if (!booking) {
        throw new Error("Booking tidak ditemukan");
      }

      // Verify user ownership
      if (booking.user_id.toString() !== userId) {
        throw new Error("QR Code tidak milik user ini");
      }

      // Check booking status
      if (booking.status !== "active") {
        throw new Error("Booking harus dalam status active untuk exit");
      }

      // Calculate actual duration and any overtime charges
      const entryTime = booking.actual_entry_time || booking.start_time;
      const exitTime = new Date();
      const actualDurationMs = exitTime - new Date(entryTime);
      const actualDurationHours = Math.ceil(
        actualDurationMs / (1000 * 60 * 60)
      );

      let additionalCost = 0;
      if (actualDurationHours > booking.duration) {
        // Get parking rates for overtime calculation
        const parking = await db.collection("parkings").findOne({
          _id: booking.parking_id,
        });
        const overtimeHours = actualDurationHours - booking.duration;
        const ratePerHour = parking.rates?.[booking.vehicle_type] || 0;
        additionalCost = overtimeHours * ratePerHour;
      }

      // Update booking status to completed
      const result = await db.collection(this.collection).findOneAndUpdate(
        { _id: new ObjectId(decoded.bookingId) },
        {
          $set: {
            status: "completed",
            actual_exit_time: exitTime,
            actual_duration: actualDurationHours,
            overtime_cost: additionalCost,
            updated_at: new Date(),
          },
        },
        { returnDocument: "after" }
      );

      // Return parking slot
      await db
        .collection("parkings")
        .updateOne(
          { _id: booking.parking_id },
          { $inc: { [`available.${booking.vehicle_type}`]: 1 } }
        );

      return {
        booking: result,
        message: `Exit berhasil! ${
          additionalCost > 0
            ? `Biaya overtime: Rp ${additionalCost.toLocaleString()}`
            : "Tidak ada biaya tambahan."
        }`,
        success: true,
        overtimeCost: additionalCost,
      };
    } catch (error) {
      throw new Error(`Scan exit gagal: ${error.message}`);
    }
  }

  static async cancel(id) {
    const db = getDB();
    const booking = await this.findById(id);

    if (!booking) {
      throw new Error("Booking tidak ditemukan");
    }

    if (booking.status === "completed" || booking.status === "cancelled") {
      throw new Error("Booking sudah selesai atau dibatalkan");
    }

    // Update status booking
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "cancelled",
          updated_at: new Date(), // Changed from updatedAt to updated_at
        },
      },
      { returnDocument: "after" }
    );

    // Kembalikan slot parkir
    await db
      .collection("parkings") // Changed from parking_lots to parkings
      .updateOne(
        { _id: booking.parking_id }, // Changed from parkingLotId to parking_id
        { $inc: { [`available.${booking.vehicle_type}`]: 1 } } // Return specific vehicle slot
      );

    return result;
  }

  static async confirm(id) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "confirmed",
          updated_at: new Date(), // Changed from updatedAt to updated_at
        },
      },
      { returnDocument: "after" }
    );

    return result;
  }
}
