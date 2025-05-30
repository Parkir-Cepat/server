import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

export class Parking {
  static collection = "parkings";

  /**
   * Setup indexes untuk collection
   */
  static async setupIndexes() {
    const db = getDB();
    await Promise.all([
      // Index untuk pencarian berdasarkan lokasi
      db.collection(this.collection).createIndex({ location: "2dsphere" }),
      // Index untuk pencarian berdasarkan pemilik
      db.collection(this.collection).createIndex({ owner_id: 1 }),
      // Index untuk sorting berdasarkan waktu pembuatan
      db.collection(this.collection).createIndex({ created_at: 1 }),
      // Index untuk pencarian berdasarkan nama
      db
        .collection(this.collection)
        .createIndex({ name: "text", description: "text" }),
    ]);
  }

  /**
   * Mencari parking berdasarkan ID
   * @param {string} id - ID parking
   * @returns {Promise<Object>} Parking document
   */
  static async findById(id) {
    const db = getDB();
    const parking = await db
      .collection(this.collection)
      .findOne({ _id: new ObjectId(id) });

    if (parking) {
      parking.available = {
        car: parking.available?.car ?? 0, // fallback untuk car
        motorcycle: parking.available?.motorcycle ?? 0, // fallback untuk motorcycle
      };
    }
    return parking;
  }

  /**
   * Membuat parking baru
   * @param {Object} parkingData - Data parking
   * @returns {Promise<Object>} Parking document yang baru dibuat
   */
  static async create(parkingData) {
    const db = getDB();
    const parking = {
      name: parkingData.name,
      address: parkingData.address,
      location: {
        type: "Point",
        coordinates: parkingData.location.coordinates,
      },
      capacity: {
        car: parkingData.capacity?.car || 0,
        motorcycle: parkingData.capacity?.motorcycle || 0,
      },
      available: {
        car: parkingData.available?.car ?? 0,
        bike: parkingData.available?.bike ?? 0,
      },
      rates: {
        car: parkingData.rates?.car || 0,
        motorcycle: parkingData.rates?.motorcycle || 0,
      },
      operational_hours: {
        open: parkingData.operational_hours?.open,
        close: parkingData.operational_hours?.close,
      },
      facilities: parkingData.facilities || [],
      images: parkingData.images || [],
      status: parkingData.status || "active",
      rating: 0,
      review_count: 0,
      owner_id: new ObjectId(parkingData.owner_id),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = await db.collection(this.collection).insertOne(parking);
    return { _id: result.insertedId, ...parking };
  }

  /**
   * Mencari parking terdekat berdasarkan lokasi
   * @param {Object} params - Parameter pencarian
   * @returns {Promise<Array>} Array of parking documents
   */
  static async findNearby({ longitude, latitude, maxDistance = 5000 }) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            distanceField: "distance",
            maxDistance: maxDistance,
            spherical: true,
          },
        },
        {
          $match: {
            available_slots: { $gt: 0 },
          },
        },
        { $limit: 20 },
      ])
      .toArray();
  }

  /**
   * Update ketersediaan slot parking
   * @param {string} parkingId - ID parking
   * @param {number} change - Perubahan jumlah slot (positif/negatif)
   * @returns {Promise<Object>} Updated parking document
   */
  static async updateAvailability(parkingId, change) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(parkingId) },
      {
        $inc: { available_slots: change },
      },
      { returnDocument: "after" }
    );
    return result;
  }

  /**
   * Mencari parking berdasarkan owner
   * @param {string} ownerId - ID owner
   * @returns {Promise<Array>} Array of parking documents
   */
  static async findByOwner(ownerId) {
    const db = getDB();
    const results = await db
      .collection(this.collection)
      .find({
        owner_id: new ObjectId(ownerId),
        is_deleted: { $ne: true }, // Pastikan tidak mengambil yang sudah dihapus
      })
      .sort({ created_at: -1 })
      .toArray();

    // Tambahkan fallback agar tidak null
    return results.map((parking) => ({
      ...parking,
      address: parking.address ?? "", // fallback untuk address
      capacity: {
        car: parking.capacity?.car ?? 0, // fallback untuk car
        motorcycle: parking.capacity?.motorcycle ?? 0, // fallback untuk motorcycle
      },
      available: {
        car: parking.available?.car ?? 0, // fallback untuk car
        motorcycle: parking.available?.motorcycle ?? 0, // fallback untuk motorcycle
      },
      operational_hours: {
        open: parking.operational_hours?.open ?? "00:00", // fallback untuk open
        close: parking.operational_hours?.close ?? "23:59", // fallback untuk close
      },
      facilities: parking.facilities || [], // fallback untuk facilities
      images: parking.images || [], // fallback untuk images
      rating: parking.rating || 0, // fallback untuk rating
      review_count: parking.review_count || 0, // fallback untuk review_count
      status: parking.status || "active", // fallback untuk status
    }));
  }

  /**
   * Update data parking
   * @param {string} parkingId - ID parking
   * @param {Object} updateData - Data yang akan diupdate
   * @returns {Promise<Object>} Updated parking document
   */
  static async update(parkingId, updateData) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(parkingId) },
      {
        $set: {
          ...updateData,
          updated_at: new Date(),
        },
      },
      { returnDocument: "after" }
    );
    return result;
  }

  /**
   * Hapus parking (soft delete)
   * @param {string} parkingId - ID parking
   * @returns {Promise<Object>} Updated parking document
   */
  static async delete(parkingId) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(parkingId) },
      {
        $set: {
          is_deleted: true,
          deleted_at: new Date(),
        },
      },
      { returnDocument: "after" }
    );
    return result;
  }

  /**
   * Mencari parking dengan filter
   * @param {Object} filters - Filter pencarian
   * @returns {Promise<Array>} Array of parking documents
   */
  static async findWithFilters(filters = {}) {
    const db = getDB();
    const query = { is_deleted: { $ne: true } };

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    if (filters.minTariff || filters.maxTariff) {
      query.tariff = {};
      if (filters.minTariff) query.tariff.$gte = filters.minTariff;
      if (filters.maxTariff) query.tariff.$lte = filters.maxTariff;
    }

    return await db
      .collection(this.collection)
      .find(query)
      .sort({ created_at: -1 })
      .toArray();
  }

  // Alias untuk backward compatibility
  static async createIndexes() {
    return await this.setupIndexes();
  }
}
