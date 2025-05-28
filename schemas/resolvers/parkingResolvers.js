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
    },

    getNearbyParkings: async (_, { longitude, latitude, maxDistance, limit }) => {
      return await Parking.findNearby({
        longitude,
        latitude,
        maxDistance: maxDistance || 5000,
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
      return await Parking.findByOwner(user._id);
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
