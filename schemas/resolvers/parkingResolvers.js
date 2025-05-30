import { Parking } from "../../models/Parking.js";
import { User } from "../../models/User.js";
import { GraphQLError } from "graphql";
import { getDB } from "../../config/db.js";

export const parkingResolvers = {
  Parking: {
    owner: async (parking) => {
      return await User.findById(parking.owner_id);
    }
  },

  Query: {
    getParking: async (_, { id }) => {
      const parking = await Parking.findById(id);
      if (!parking) throw new Error("Tempat parkir tidak ditemukan");
      return parking;
    },    getNearbyParkings: async (_, { longitude, latitude, maxDistance, vehicleType, limit }) => {
      return await Parking.findNearby({
        longitude,
        latitude,
        maxDistance: maxDistance || 5000,
        vehicleType,
        limit: limit || 20
      });
    },

    getMyParkings: async (_, __, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      if (user.role !== "landowner") {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }
      
      const parkings = await Parking.findByOwner(user._id);
      
      // Filter out invalid parking data and ensure all required fields exist
      return parkings.filter(parking => {
        // Skip if missing required fields according to GraphQL schema
        if (!parking.address || !parking.name) {
          console.warn(`Skipping invalid parking ${parking._id}: missing required fields`);
          return false;
        }
        
        // Skip if has old structure
        if (parking.total_slots || parking.available_slots || parking.tariff) {
          console.warn(`Skipping old structure parking ${parking._id}: ${parking.name}`);
          return false;
        }
        
        // Skip if missing new structure
        if (!parking.capacity || !parking.available || !parking.rates || !parking.operational_hours) {
          console.warn(`Skipping incomplete parking ${parking._id}: ${parking.name}`);
          return false;
        }
        
        return true;
      }).map(parking => ({
        // Ensure all fields exist with defaults
        ...parking,
        facilities: parking.facilities || [],
        images: parking.images || [],
        status: parking.status || 'active',
        rating: parking.rating || 0,
        review_count: parking.review_count || 0,
        updated_at: parking.updated_at || parking.created_at
      }));
    },

    searchParkings: async (_, { query, limit }) => {
      const db = getDB();
      const searchQuery = {
        $or: [
          { name: { $regex: query, $options: "i" } },
          { description: { $regex: query, $options: "i" } }
        ]
      };

      return await db.collection(Parking.collection)
        .find(searchQuery)
        .limit(limit || 20)
        .toArray();
    }
  },

  Mutation: {
    createParking: async (_, { input }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      if (user.role !== "landowner") {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return await Parking.create({
        ...input,
        owner_id: user._id
      });
    },

    updateParking: async (_, { id, input }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const parking = await Parking.findById(id);
      if (!parking) throw new Error("Tempat parkir tidak ditemukan");

      if (parking.owner_id.toString() !== user._id.toString() && user.role !== "admin") {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return await Parking.update(id, input);
    },

    deleteParking: async (_, { id }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const parking = await Parking.findById(id);
      if (!parking) throw new Error("Tempat parkir tidak ditemukan");

      if (parking.owner_id.toString() !== user._id.toString() && user.role !== "admin") {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      await Parking.delete(id);
      return true;
    },

    updateParkingAvailability: async (_, { id, available_slots }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const parking = await Parking.findById(id);
      if (!parking) throw new Error("Tempat parkir tidak ditemukan");

      if (parking.owner_id.toString() !== user._id.toString() && user.role !== "admin") {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return await Parking.updateAvailability(id, available_slots);
    }
  }
};
