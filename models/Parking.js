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
      db.collection(this.collection).createIndex({ name: "text", description: "text" })
    ]);
  }

  /**
   * Mencari parking berdasarkan ID
   * @param {string} id - ID parking
   * @returns {Promise<Object>} Parking document
   */
  static async findById(id) {
    const db = getDB();
    return await db.collection(this.collection).findOne({ _id: new ObjectId(id) });
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
        coordinates: parkingData.location.coordinates
      },
      owner_id: new ObjectId(parkingData.owner_id),
      capacity: {
        car: parkingData.capacity.car,
        motorcycle: parkingData.capacity.motorcycle
      },
      available: {
        car: parkingData.capacity.car, // Initially all slots are available
        motorcycle: parkingData.capacity.motorcycle
      },
      rates: {
        car: parkingData.rates.car,
        motorcycle: parkingData.rates.motorcycle
      },
      operational_hours: {
        open: parkingData.operational_hours.open,
        close: parkingData.operational_hours.close
      },
      facilities: parkingData.facilities || [],
      images: parkingData.images || [],
      status: 'active',
      rating: 0,
      review_count: 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection(this.collection).insertOne(parking);
    return { _id: result.insertedId, ...parking };
  }
  /**
   * Mencari parking terdekat berdasarkan lokasi
   * @param {Object} params - Parameter pencarian
   * @returns {Promise<Array>} Array of parking documents
   */
  static async findNearby({ longitude, latitude, maxDistance = 5000, vehicleType = null, limit = 20 }) {
    const db = getDB();
    
    const pipeline = [
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [longitude, latitude]
          },
          distanceField: "distance",
          maxDistance: maxDistance,
          spherical: true
        }
      },
      {
        $match: {
          status: 'active',
          is_deleted: { $ne: true },
          $or: [
            { "available.car": { $gt: 0 } },
            { "available.motorcycle": { $gt: 0 } }
          ]
        }
      }
    ];

    // Add vehicle type filter if specified
    if (vehicleType === 'car') {
      pipeline[1].$match = {
        ...pipeline[1].$match,
        "available.car": { $gt: 0 }
      };
      delete pipeline[1].$match.$or;
    } else if (vehicleType === 'motorcycle') {
      pipeline[1].$match = {
        ...pipeline[1].$match,
        "available.motorcycle": { $gt: 0 }
      };
      delete pipeline[1].$match.$or;
    }

    pipeline.push({ $limit: limit });

    return await db.collection(this.collection).aggregate(pipeline).toArray();
  }
  /**
   * Update ketersediaan slot parking
   * @param {string} parkingId - ID parking
   * @param {string} vehicleType - Type of vehicle ('car' or 'motorcycle')
   * @param {number} change - Perubahan jumlah slot (positif/negatif)
   * @returns {Promise<Object>} Updated parking document
   */
  static async updateAvailability(parkingId, vehicleType, change) {
    const db = getDB();
    const updateField = vehicleType === 'car' ? 'available.car' : 'available.motorcycle';
    
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(parkingId) },
      { 
        $inc: { [updateField]: change },
        $set: { updated_at: new Date() }
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
    return await db.collection(this.collection)
      .find({ owner_id: new ObjectId(ownerId) })
      .sort({ created_at: -1 })
      .toArray();
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
          updated_at: new Date()
        }
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
          deleted_at: new Date()
        }
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
    const query = { 
      is_deleted: { $ne: true },
      status: 'active'
    };

    if (filters.search) {
      query.$text = { $search: filters.search };
    }

    if (filters.minCarRate || filters.maxCarRate) {
      query["rates.car"] = {};
      if (filters.minCarRate) query["rates.car"].$gte = filters.minCarRate;
      if (filters.maxCarRate) query["rates.car"].$lte = filters.maxCarRate;
    }

    if (filters.minMotorcycleRate || filters.maxMotorcycleRate) {
      query["rates.motorcycle"] = {};
      if (filters.minMotorcycleRate) query["rates.motorcycle"].$gte = filters.minMotorcycleRate;
      if (filters.maxMotorcycleRate) query["rates.motorcycle"].$lte = filters.maxMotorcycleRate;
    }

    if (filters.vehicleType) {
      if (filters.vehicleType === 'car') {
        query["available.car"] = { $gt: 0 };
      } else if (filters.vehicleType === 'motorcycle') {
        query["available.motorcycle"] = { $gt: 0 };
      }
    }

    return await db.collection(this.collection)
      .find(query)
      .sort({ created_at: -1 })
      .toArray();
  }

  // Alias untuk backward compatibility
  static async createIndexes() {
    return await this.setupIndexes();
  }
}