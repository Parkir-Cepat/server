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

    const existingParking = await db
      .collection(this.collection)
      .findOne({ _id: new ObjectId(parkingId) });

    if (!existingParking) {
      return null;
    }

    const updated = {
      ...existingParking,
      ...updateData,
      available: {
        motorcycle:
          updateData.available?.motorcycle ??
          existingParking.available?.motorcycle ??
          0,
        car: updateData.available?.car ?? existingParking.available?.car ?? 0,
        ...((updateData.available || {}).otherFields || {}), // jika ada properti lain
      },
      rates: {
        ...existingParking.rates,
        ...(updateData.rates || {}),
      },
      operational_hours: {
        ...existingParking.operational_hours,
        ...(updateData.operational_hours || {}),
      },
      updated_at: new Date(),
    };

    // Coba cek versi alternatif jika returnDocument tidak bekerja
    await db
      .collection(this.collection)
      .updateOne({ _id: new ObjectId(parkingId) }, { $set: updated });

    return await db
      .collection(this.collection)
      .findOne({ _id: new ObjectId(parkingId) });
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

  /**
   * Mendapatkan statistik untuk owner
   * @param {string} ownerId - ID owner
   * @returns {Promise<Object>} Owner statistics
   */
  static async getOwnerStats(ownerId) {
    const db = getDB();

    try {
      // 1. Get user balance (current balance = total balance untuk sekarang)
      const user = await db.collection("users").findOne({
        _id: new ObjectId(ownerId),
      });
      const currentBalance = user?.saldo || 0;

      // 2. Get all parkings for this owner
      const parkings = await db
        .collection(this.collection)
        .find({
          owner_id: new ObjectId(ownerId),
          is_deleted: { $ne: true },
        })
        .toArray();

      // 3. Calculate average rating
      const ratingsSum = parkings.reduce(
        (sum, parking) => sum + (parking.rating || 0),
        0
      );
      const averageRating =
        parkings.length > 0 ? ratingsSum / parkings.length : 0;

      // 4. Get total income from bookings/transactions
      const parkingIds = parkings.map((p) => p._id);

      const incomeAggregation = await db
        .collection("bookings")
        .aggregate([
          {
            $match: {
              parking_id: { $in: parkingIds },
              status: { $in: ["completed", "paid"] }, // hanya yang sudah selesai/dibayar
            },
          },
          {
            $group: {
              _id: null,
              totalIncome: { $sum: "$total_price" },
              totalBookings: { $sum: 1 },
            },
          },
        ])
        .toArray();

      const stats = incomeAggregation[0] || {
        totalIncome: 0,
        totalBookings: 0,
      };

      return {
        totalBalance: currentBalance, // untuk sekarang sama dengan current balance
        currentBalance: currentBalance,
        totalIncome: stats.totalIncome || 0,
        totalBookings: stats.totalBookings || 0,
        averageRating: parseFloat(averageRating.toFixed(1)),
      };
    } catch (error) {
      console.error("Error getting owner stats:", error);
      throw new Error("Failed to get owner statistics");
    }
  }

  /**
   * Mendapatkan statistik detail untuk satu parking spesifik
   * @param {string} parkingId - ID parking
   * @returns {Promise<Object>} Parking statistics
   */
  static async getParkingStats(parkingId) {
    const db = getDB();

    try {
      // Get parking info
      const parking = await db.collection(this.collection).findOne({
        _id: new ObjectId(parkingId),
      });

      if (!parking) {
        throw new Error("Parking not found");
      }

      // Get all bookings for this parking
      const bookings = await db
        .collection("bookings")
        .find({
          parking_id: new ObjectId(parkingId),
          status: { $in: ["completed", "paid"] },
        })
        .toArray();

      // Calculate total revenue and bookings
      const totalRevenue = bookings.reduce(
        (sum, booking) => sum + (booking.total_price || 0),
        0
      );
      const totalBookings = bookings.length;

      // Calculate current occupancy rate
      const totalCapacity =
        (parking.capacity?.car || 0) + (parking.capacity?.motorcycle || 0);
      const currentAvailable =
        (parking.available?.car || 0) + (parking.available?.motorcycle || 0);
      const currentOccupancyRate =
        totalCapacity > 0
          ? ((totalCapacity - currentAvailable) / totalCapacity) * 100
          : 0;

      // Calculate vehicle distribution
      const carBookings = bookings.filter(
        (b) => b.vehicle_type === "car"
      ).length;
      const motorcycleBookings = bookings.filter(
        (b) => b.vehicle_type === "motorcycle"
      ).length;
      const vehicleDistribution = {
        car: carBookings,
        motorcycle: motorcycleBookings,
        carPercentage:
          totalBookings > 0 ? (carBookings / totalBookings) * 100 : 0,
        motorcyclePercentage:
          totalBookings > 0 ? (motorcycleBookings / totalBookings) * 100 : 0,
      };

      // Calculate daily stats (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const dailyStatsAggregation = await db
        .collection("bookings")
        .aggregate([
          {
            $match: {
              parking_id: new ObjectId(parkingId),
              status: { $in: ["completed", "paid"] },
              created_at: { $gte: sevenDaysAgo },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
              },
              revenue: { $sum: "$total_price" },
              bookings: { $sum: 1 },
            },
          },
          {
            $sort: { _id: 1 },
          },
        ])
        .toArray();

      const dailyStats = dailyStatsAggregation.map((day) => ({
        date: day._id,
        revenue: day.revenue || 0,
        bookings: day.bookings || 0,
        occupancyRate: Math.random() * 100, // Placeholder - calculate based on time slots
      }));

      // Calculate monthly stats (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const monthlyStatsAggregation = await db
        .collection("bookings")
        .aggregate([
          {
            $match: {
              parking_id: new ObjectId(parkingId),
              status: { $in: ["completed", "paid"] },
              created_at: { $gte: sixMonthsAgo },
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$created_at" } },
              revenue: { $sum: "$total_price" },
              bookings: { $sum: 1 },
            },
          },
          {
            $sort: { _id: 1 },
          },
        ])
        .toArray();

      const monthlyStats = monthlyStatsAggregation.map((month) => ({
        month: month._id,
        revenue: month.revenue || 0,
        bookings: month.bookings || 0,
        averageOccupancy: Math.random() * 100, // Placeholder
      }));

      // Calculate peak hours
      const hourlyBookings = await db
        .collection("bookings")
        .aggregate([
          {
            $match: {
              parking_id: new ObjectId(parkingId),
              status: { $in: ["completed", "paid"] },
            },
          },
          {
            $group: {
              _id: { $hour: "$start_time" },
              count: { $sum: 1 },
            },
          },
          {
            $sort: { count: -1 },
          },
          {
            $limit: 3,
          },
        ])
        .toArray();

      const peakHours = hourlyBookings.map((hour) => hour._id);

      // Find best and worst performing days
      const bestDay =
        dailyStats.length > 0
          ? dailyStats.reduce((prev, current) =>
              prev.revenue > current.revenue ? prev : current
            ).date
          : null;

      const worstDay =
        dailyStats.length > 0
          ? dailyStats.reduce((prev, current) =>
              prev.revenue < current.revenue ? prev : current
            ).date
          : null;

      return {
        parkingId: parkingId,
        parkingName: parking.name,
        totalRevenue,
        totalBookings,
        averageRating: parking.rating || 0,
        currentOccupancyRate: parseFloat(currentOccupancyRate.toFixed(1)),
        dailyStats,
        monthlyStats,
        vehicleDistribution,
        peakHours,
        bestDay,
        worstDay,
      };
    } catch (error) {
      console.error("Error getting parking stats:", error);
      throw new Error("Failed to get parking statistics");
    }
  }
}
