import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

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
} 