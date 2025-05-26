import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { generateBookingQR, generateParkingAccessQR } from "../helpers/qrcode.js";

export class Booking {
  static collection = "bookings";

  static async findById(id) {
    const db = getDB();
    return await db.collection(this.collection).findOne({ _id: new ObjectId(id) });
  }

  static async create(bookingData) {
    const db = getDB();
    const {
      userId,
      parkingLotId,
      vehicleType,
      startTime,
      duration
    } = bookingData;

    // Dapatkan detail parkir
    const parking = await db.collection("parkings").findOne({ 
      _id: new ObjectId(parkingLotId) 
    });
    
    if (!parking) {
      throw new Error("Tempat parkir tidak ditemukan");
    }

    if (parking.availableSlots <= 0) {
      throw new Error("Slot parkir tidak tersedia");
    }

    // Hitung total biaya
    const totalCost = parking.tariff * duration;

    // Buat booking
    const booking = {
      userId: new ObjectId(userId),
      parkingLotId: new ObjectId(parkingLotId),
      vehicleType,
      startTime: new Date(startTime),
      duration,
      cost: totalCost,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection(this.collection).insertOne(booking);

    // Update ketersediaan parkir
    await db.collection("parkings").updateOne(
      { _id: new ObjectId(parkingLotId) },
      { $inc: { availableSlots: -1 } }
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
      },
      { returnDocument: 'after' }
    );

    return result.value;
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
      },
      { returnDocument: 'after' }
    );

    return result.value;
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
      },
      { returnDocument: 'after' }
    );

    return result.value;
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
      { returnDocument: 'after' }
    );

    // Kembalikan slot parkir
    await db.collection("parkings").updateOne(
      { _id: booking.parkingLotId },
      { $inc: { availableSlots: 1 } }
    );

    return result.value;
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
      },
      { returnDocument: 'after' }
    );

    return result.value;
  }
} 