import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

export class Parking {
  static collection = "parkings";

  static async findById(id) {
    const db = getDB();
    return await db.collection(this.collection).findOne({ _id: new ObjectId(id) });
  }

  static async create(parkingData) {
    const db = getDB();
    const parking = {
      ...parkingData,
      location: {
        type: "Point",
        coordinates: parkingData.location.coordinates
      },
      availableSlots: parkingData.totalSlots,
      createdAt: new Date()
    };

    const result = await db.collection(this.collection).insertOne(parking);
    return { _id: result.insertedId, ...parking };
  }

  static async findNearby({ longitude, latitude, maxDistance = 5000 }) {
    const db = getDB();
    return await db.collection(this.collection).find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude]
          },
          $maxDistance: maxDistance // dalam meter
        }
      },
      availableSlots: { $gt: 0 }
    }).toArray();
  }

  static async updateAvailability(parkingId, change) {
    const db = getDB();
    const parking = await this.findById(parkingId);
    
    if (!parking) {
      throw new Error("Tempat parkir tidak ditemukan");
    }

    const newAvailable = parking.availableSlots + change;
    if (newAvailable < 0 || newAvailable > parking.totalSlots) {
      throw new Error("Slot parkir tidak valid");
    }    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(parkingId) },
      { $inc: { availableSlots: change } },
      { returnDocument: "after" }
    );
    return result;
  }

  static async findByOwner(ownerId) {
    const db = getDB();
    return await db.collection(this.collection)
      .find({ ownerId: new ObjectId(ownerId) })
      .toArray();
  }

  // Inisialisasi indexes yang diperlukan
  static async createIndexes() {
    const db = getDB();
    await Promise.all([
      // Index untuk pencarian berdasarkan lokasi
      db.collection(this.collection).createIndex({ location: "2dsphere" }),
      // Index untuk pencarian berdasarkan pemilik
      db.collection(this.collection).createIndex({ ownerId: 1 }),
      // Index untuk sorting berdasarkan waktu pembuatan
      db.collection(this.collection).createIndex({ createdAt: 1 })
    ]);
  }
} 