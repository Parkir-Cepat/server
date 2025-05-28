import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { generateBookingQR, generateParkingAccessQR } from "../helpers/qrcode.js";

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
      db.collection(this.collection).createIndex({ created_at: 1 })
    ]);
  }

  /**
   * Mencari booking berdasarkan ID
   * @param {string} id - ID booking
   * @returns {Promise<Object>} Booking document
   */
  static async findById(id) {
    const db = getDB();
    return await db.collection(this.collection).findOne({ _id: new ObjectId(id) });
  }

  /**
   * Membuat booking baru
   * @param {Object} bookingData - Data booking
   * @returns {Promise<Object>} Booking document yang baru dibuat
   */
  static async create(bookingData) {
    const db = getDB();
    const {
      user_id,
      parking_id,
      booking_time,
      start_time,
      end_time,
      price
    } = bookingData;    // Dapatkan detail parkir
    const parking = await db.collection("parkings").findOne({ 
      _id: new ObjectId(parking_id) 
    });
    
    if (!parking) {
      throw new Error("Tempat parkir tidak ditemukan");
    }

    // Check availability
    if (!parking.available_slots || parking.available_slots <= 0) {
      throw new Error("Slot parkir tidak tersedia");
    }

    // Check for overlapping bookings (optional - for more sophisticated booking)
    const overlappingBookings = await db.collection(this.collection).countDocuments({
      parking_id: new ObjectId(parking_id),
      status: { $in: ["pending", "confirmed"] },
      $or: [
        {
          start_time: { $lte: new Date(start_time) },
          end_time: { $gt: new Date(start_time) }
        },
        {
          start_time: { $lt: new Date(end_time) },
          end_time: { $gte: new Date(end_time) }
        }
      ]
    });

    if (overlappingBookings >= parking.available_slots) {
      throw new Error("Slot parkir tidak tersedia untuk waktu yang dipilih");
    }

    const booking = {
      user_id: new ObjectId(user_id),
      parking_id: new ObjectId(parking_id),
      booking_time: new Date(booking_time),
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      price,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection(this.collection).insertOne(booking);    // Update available slots
    await db.collection("parkings").updateOne(
      { _id: new ObjectId(parking_id) },
      { $inc: { available_slots: -1 } }
    );

    return { _id: result.insertedId, ...booking };
  }

  static async updateStatus(id, status) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: {
          status,
          updatedAt: new Date()
        }
      },      { returnDocument: 'after' }
    );

    return result;
  }

  static async getActiveBookings(userId) {
    const db = getDB();
    return await db.collection(this.collection)
      .find({
        userId: new ObjectId(userId),
        status: { $in: ['pending', 'confirmed'] }
      })
      .sort({ startTime: -1 })
      .toArray();
  }

  static async getBookingHistory(userId) {
    const db = getDB();
    return await db.collection(this.collection)
      .find({
        userId: new ObjectId(userId),
        status: { $in: ['completed', 'cancelled'] }
      })
      .sort({ startTime: -1 })
      .toArray();
  }

  static async setupIndexes() {
    const db = getDB();
    await db.collection(this.collection).createIndex({ userId: 1 });
    await db.collection(this.collection).createIndex({ parkingLotId: 1 });
    await db.collection(this.collection).createIndex({ status: 1 });
    await db.collection(this.collection).createIndex({ startTime: 1 });
  }

  static async extend(id, additionalDuration, additionalCost) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $inc: {
          duration: additionalDuration,
          cost: additionalCost
        },
        $set: { updatedAt: new Date() }
      },      { returnDocument: 'after' }
    );

    return result;
  }

  static async getExpiredBookings() {
    const db = getDB();
    const now = new Date();

    return await db.collection(this.collection)
      .find({
        status: { $in: ['pending', 'confirmed'] },
        $expr: {
          $lt: [
            {
              $add: [
                '$startTime',
                { $multiply: ['$duration', 60 * 60 * 1000] } // Konversi jam ke milidetik
              ]
            },
            now
          ]
        }
      })
      .toArray();
  }

  static async generateQRCode(id) {
    const db = getDB();
    const booking = await this.findById(id);
    
    if (!booking) {
      throw new Error("Booking tidak ditemukan");
    }

    if (booking.status !== 'confirmed') {
      throw new Error("QR Code hanya bisa dibuat untuk booking yang sudah dikonfirmasi");
    }

    // Generate QR code
    const qrCode = await generateBookingQR(booking);

    // Update booking dengan QR code
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: {
          qrCode,
          updatedAt: new Date()
        }
      },      { returnDocument: 'after' }
    );

    return result;
  }

  static async generateAccessQR(id, type) {
    const booking = await this.findById(id);
    
    if (!booking) {
      throw new Error("Booking tidak ditemukan");
    }

    if (booking.status !== 'confirmed') {
      throw new Error("QR Code akses hanya bisa dibuat untuk booking yang sudah dikonfirmasi");
    }

    const qrCode = await generateParkingAccessQR({
      type, // 'entry' atau 'exit'
      bookingId: id,
      parkingLotId: booking.parkingLotId.toString()
    });

    // Update booking berdasarkan type
    const db = getDB();
    const updateField = type === 'entry' ? 'entryQR' : 'exitQR';
    
    await db.collection(this.collection).updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: {
          [updateField]: qrCode,
          updatedAt: new Date()
        }
      }
    );

    return qrCode;
  }

  static async findByParkingLot(parkingLotId) {
    const db = getDB();
    return await db.collection(this.collection)
      .find({ parkingLotId: new ObjectId(parkingLotId) })
      .sort({ startTime: -1 })
      .toArray();
  }

  static async cancel(id) {
    const db = getDB();
    const booking = await this.findById(id);
    
    if (!booking) {
      throw new Error("Booking tidak ditemukan");
    }

    if (booking.status === 'completed' || booking.status === 'cancelled') {
      throw new Error("Booking sudah selesai atau dibatalkan");
    }

    // Update status booking
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: {
          status: 'cancelled',
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }    );    // Kembalikan slot parkir
    await db.collection("parking_lots").updateOne(
      { _id: booking.parkingLotId },
      { $inc: { availableSlots: 1 } }
    );

    return result;
  }

  static async confirm(id) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: {
          status: 'confirmed',
          updatedAt: new Date()
        }
      },      { returnDocument: 'after' }
    );

    return result;
  }
}