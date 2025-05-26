import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

export class ParkingLot {
  static collection = "parking_lots";

  static async findById(id) {
    const db = getDB();
    return await db.collection(this.collection).findOne({ _id: new ObjectId(id) });
  }

  static async create(parkingLotData) {
    const db = getDB();
    const parkingLot = {
      ...parkingLotData,
      location: {
        type: "Point",
        coordinates: parkingLotData.location.coordinates
      },
      available: {
        car: parkingLotData.capacity.car,
        motorcycle: parkingLotData.capacity.motorcycle
      },
      rating: 0,
      reviewCount: 0,
      status: "active",
      ownerId: new ObjectId(parkingLotData.ownerId),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection(this.collection).insertOne(parkingLot);
    return { _id: result.insertedId, ...parkingLot };
  }

  static async findNearby({ longitude, latitude, maxDistance = 5000, vehicleType }) {
    const db = getDB();
    const query = {
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude]
          },
          $maxDistance: maxDistance // dalam meter
        }
      },
      status: "active"
    };

    // Tambahkan pengecekan ketersediaan kendaraan jika ditentukan
    if (vehicleType) {
      query["available." + vehicleType] = { $gt: 0 };
    }

    return await db.collection(this.collection).find(query).toArray();
  }

  static async updateAvailability(parkingLotId, vehicleType, change) {
    const db = getDB();
    const updateQuery = {};
    updateQuery["available." + vehicleType] = change;

    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(parkingLotId) },
      { 
        $inc: updateQuery,
        $set: { updatedAt: new Date() }
      },
      { returnDocument: "after" }
    );
    return result.value;
  }

  static async updateRating(parkingLotId, newRating) {
    const db = getDB();
    const parkingLot = await this.findById(parkingLotId);

    if (!parkingLot) {
      throw new Error("Tempat parkir tidak ditemukan");
    }

    const newAvgRating = (
      (parkingLot.rating * parkingLot.reviewCount + newRating) / 
      (parkingLot.reviewCount + 1)
    ).toFixed(1);

    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(parkingLotId) },
      { 
        $set: { 
          rating: parseFloat(newAvgRating),
          updatedAt: new Date()
        },
        $inc: { reviewCount: 1 }
      },
      { returnDocument: "after" }
    );
    return result.value;
  }

  static async findByOwner(ownerId) {
    const db = getDB();
    return await db.collection(this.collection)
      .find({ 
        ownerId: new ObjectId(ownerId),
        status: "active"
      })
      .toArray();
  }

  static async update(parkingLotId, updateData) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(parkingLotId) },
      { 
        $set: {
          ...updateData,
          updatedAt: new Date()
        }
      },
      { returnDocument: "after" }
    );
    return result.value;
  }

  static async delete(parkingLotId) {
    const db = getDB();
    // Soft delete dengan mengubah status menjadi inactive
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(parkingLotId) },
      { 
        $set: { 
          status: "inactive",
          updatedAt: new Date()
        }
      },
      { returnDocument: "after" }
    );
    return result.value;
  }

  static async setupIndexes() {
    const db = getDB();
    await Promise.all([
      // Index untuk pencarian berdasarkan lokasi
      db.collection(this.collection).createIndex({ location: "2dsphere" }),
      // Index untuk pencarian berdasarkan pemilik
      db.collection(this.collection).createIndex({ ownerId: 1 }),
      // Index untuk pencarian berdasarkan status
      db.collection(this.collection).createIndex({ status: 1 }),
      // Index untuk sorting berdasarkan rating
      db.collection(this.collection).createIndex({ rating: -1 }),
      // Index untuk sorting berdasarkan waktu pembuatan
      db.collection(this.collection).createIndex({ createdAt: 1 }),
      // Index untuk pencarian berdasarkan nama dan alamat
      db.collection(this.collection).createIndex({ name: 'text', address: 'text' })
    ]);
  }

  static async createIndexes() {
    return await this.setupIndexes();
  }
} 