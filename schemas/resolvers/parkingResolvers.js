import { Parking } from "../../models/Parking.js";
import { User } from "../../models/User.js";
import { GraphQLError } from "graphql";
import { getDB } from "../../config/db.js";

export const parkingResolvers = {
  Parking: {
    owner: async (parking) => {
      return await User.findById(parking.owner_id);
    },
  },

  Query: {
    getOwnerStats: async (_, __, { user }) => {
      if (!user) {
        throw new GraphQLError("User not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      return await Parking.getOwnerStats(user.id);
    },

    getParkingStats: async (_, { parkingId }, { user }) => {
      if (!user) {
        throw new GraphQLError("User not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Verify parking belongs to this owner
      const parking = await Parking.findById(parkingId);
      if (!parking || parking.owner_id.toString() !== user._id.toString()) {
        throw new GraphQLError("Access denied to this parking stats", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      return await Parking.getParkingStats(parkingId);
    },

    getParking: async (_, { id }) => {
      const parking = await Parking.findById(id);
      if (!parking) throw new Error("Tempat parkir tidak ditemukan");
      return parking;
    },

    getNearbyParkings: async (
      _,
      { longitude, latitude, maxDistance, limit, vehicleType }
    ) => {
      console.log("getNearbyParkings called with:", {
        longitude,
        latitude,
        maxDistance,
        limit,
        vehicleType,
      });

      try {
        const result = await Parking.findNearby({
          longitude,
          latitude,
          maxDistance: maxDistance || 50000,
          limit: limit || 20,
          vehicleType,
        });

        console.log("findNearby result:", result);
        return result;
      } catch (error) {
        console.error("Error in getNearbyParkings:", error);
        throw new GraphQLError("Failed to find nearby parkings", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },

    getMyParkings: async (_, __, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      if (user.role !== "landowner") {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      const parkings = await Parking.findByOwner(user._id);

      // Filter out invalid parking data and ensure all required fields exist
      return parkings
        .filter((parking) => {
          // Skip if missing required fields according to GraphQL schema
          if (!parking.address || !parking.name) {
            console.warn(
              `Skipping invalid parking ${parking._id}: missing required fields`
            );
            return false;
          }

          // Skip if has old structure
          if (
            parking.total_slots ||
            parking.available_slots ||
            parking.tariff
          ) {
            console.warn(
              `Skipping old structure parking ${parking._id}: ${parking.name}`
            );
            return false;
          }

          // Skip if missing new structure
          if (
            !parking.capacity ||
            !parking.available ||
            !parking.rates ||
            !parking.operational_hours
          ) {
            console.warn(
              `Skipping incomplete parking ${parking._id}: ${parking.name}`
            );
            return false;
          }

          return true;
        })
        .map((parking) => ({
          // Ensure all fields exist with defaults
          ...parking,
          facilities: parking.facilities || [],
          images: parking.images || [],
          status: parking.status || "active",
          rating: parking.rating || 0,
          review_count: parking.review_count || 0,
          updated_at: parking.updated_at || parking.created_at,
        }));
    },

    searchParkings: async (_, { query, limit }) => {
      const db = getDB();
      const searchQuery = {
        $or: [
          { name: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } },
        ],
      };

      return await db
        .collection(Parking.collection)
        .find(searchQuery)
        .limit(limit || 20)
        .toArray();
    },

    parkingsByOwner: async (_, { ownerId }, { user }) => {
      if (!user) {
        throw new GraphQLError("User not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      if (!ownerId) {
        throw new GraphQLError("Owner ID is required", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      try {
        const parkings = await Parking.find({ owner_id: ownerId }).toArray();
        return parkings;
      } catch (error) {
        console.error("Error fetching parkings by owner:", error);
        throw new GraphQLError("Failed to fetch parkings by owner");
      }
    },
  },

  Mutation: {
    createParking: async (_, { input }, { user }) => {
      if (!user) {
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      try {
        // Ensure proper GeoJSON format for location
        const locationData = input.location
          ? {
              type: "Point",
              coordinates: input.location.coordinates,
            }
          : null;

        const parkingData = {
          ...input,
          location: locationData,
          owner_id: user._id,
          // Set available sama dengan capacity saat create
          available: {
            car: input.capacity.car,
            motorcycle: input.capacity.motorcycle,
          },
          rating: 0,
          review_count: 0,
          status: "active",
        };

        const parking = await Parking.create(parkingData);

        console.log(`✅ Parking created with proper GeoJSON:`, {
          location: parking.location,
          capacity: parking.capacity,
          available: parking.available,
        });

        return parking;
      } catch (error) {
        console.error("❌ Create parking error:", error);
        throw new Error(`Gagal membuat parking: ${error.message}`);
      }
    },

    updateParking: async (_, { id, input }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const parking = await Parking.findById(id);
      if (!parking) throw new Error("Tempat parkir tidak ditemukan");

      if (
        parking.owner_id.toString() !== user._id.toString() &&
        user.role !== "admin"
      ) {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      const updated = await Parking.update(id, input);
      if (!updated) {
        throw new GraphQLError("Gagal memperbarui data parkir", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }

      return updated;
    },

    deleteParking: async (_, { id }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const parking = await Parking.findById(id);
      if (!parking) throw new Error("Tempat parkir tidak ditemukan");

      if (
        parking.owner_id.toString() !== user._id.toString() &&
        user.role !== "admin"
      ) {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      await Parking.delete(id);
      return true;
    },

    updateParkingAvailability: async (_, { id, available_slots }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const parking = await Parking.findById(id);
      if (!parking) throw new Error("Tempat parkir tidak ditemukan");

      if (
        parking.owner_id.toString() !== user._id.toString() &&
        user.role !== "admin"
      ) {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      return await Parking.updateAvailability(id, available_slots);
    },

    // Fix parking available slots
    fixParkingAvailability: async (_, { parking_id }, { user }) => {
      if (!user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const db = getDB();
      const parking = await db.collection("parkings").findOne({
        _id: new ObjectId(parking_id),
      });

      if (!parking) {
        throw new Error("Parking tidak ditemukan");
      }

      // Check if user is owner or admin
      if (
        parking.owner_id.toString() !== user._id.toString() &&
        user.role !== "admin"
      ) {
        throw new Error("Tidak memiliki akses");
      }

      // Count actual bookings that are active
      const activeBookings = await db
        .collection("bookings")
        .aggregate([
          {
            $match: {
              parking_id: new ObjectId(parking_id),
              status: { $in: ["pending", "confirmed"] },
            },
          },
          {
            $group: {
              _id: "$vehicle_type",
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      // Calculate actual available slots
      const carBookings =
        activeBookings.find((b) => b._id === "car")?.count || 0;
      const motorcycleBookings =
        activeBookings.find((b) => b._id === "motorcycle")?.count || 0;

      const actualAvailable = {
        car: Math.max(0, parking.capacity.car - carBookings),
        motorcycle: Math.max(
          0,
          parking.capacity.motorcycle - motorcycleBookings
        ),
      };

      // Update parking with correct available slots
      const result = await db.collection("parkings").findOneAndUpdate(
        { _id: new ObjectId(parking_id) },
        {
          $set: {
            available: actualAvailable,
            updated_at: new Date(),
          },
        },
        { returnDocument: "after" }
      );

      console.log(`✅ Fixed parking availability:`, {
        parking_id,
        capacity: parking.capacity,
        activeBookings: { car: carBookings, motorcycle: motorcycleBookings },
        newAvailable: actualAvailable,
      });

      return result;
    },
  },
};
