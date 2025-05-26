import { ParkingLot } from "../../models/ParkingLot.js";
import { User } from "../../models/User.js";
import { GraphQLError } from "graphql";
import { getDB } from "../../config/db.js";

export const parkingLotResolvers = {
  ParkingLot: {
    owner: async (parkingLot) => {
      return await User.findById(parkingLot.ownerId);
    }
  },

  Query: {
    getParkingLot: async (_, { id }) => {
      const parkingLot = await ParkingLot.findById(id);
      if (!parkingLot) throw new Error("Tempat parkir tidak ditemukan");
      return parkingLot;
    },

    getNearbyParkingLots: async (_, { longitude, latitude, maxDistance, vehicleType }) => {
      return await ParkingLot.findNearby({
        longitude,
        latitude,
        maxDistance,
        vehicleType
      });
    },

    getMyParkingLots: async (_, __, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      if (user.role !== "landowner") {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }
      return await ParkingLot.findByOwner(user._id);
    },

    searchParkingLots: async (_, { query, vehicleType, sortBy }) => {
      const db = getDB();
      const searchQuery = {
        status: "active",
        $or: [
          { name: { $regex: query, $options: "i" } },
          { address: { $regex: query, $options: "i" } }
        ]
      };

      if (vehicleType) {
        searchQuery["available." + vehicleType] = { $gt: 0 };
      }

      let sortOptions = {};
      if (sortBy === "rating") {
        sortOptions.rating = -1;
      } else if (sortBy === "distance") {
        // Distance sorting handled by $near in getNearbyParkingLots
        return [];
      }

      return await db.collection(ParkingLot.collection)
        .find(searchQuery)
        .sort(sortOptions)
        .toArray();
    }
  },

  Mutation: {
    createParkingLot: async (_, { input }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      if (user.role !== "landowner") {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return await ParkingLot.create({
        ...input,
        ownerId: user._id
      });
    },

    updateParkingLot: async (_, { id, input }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const parkingLot = await ParkingLot.findById(id);
      if (!parkingLot) throw new Error("Tempat parkir tidak ditemukan");

      if (parkingLot.ownerId.toString() !== user._id && user.role !== "admin") {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return await ParkingLot.update(id, input);
    },

    deleteParkingLot: async (_, { id }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const parkingLot = await ParkingLot.findById(id);
      if (!parkingLot) throw new Error("Tempat parkir tidak ditemukan");

      if (parkingLot.ownerId.toString() !== user._id && user.role !== "admin") {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      await ParkingLot.delete(id);
      return true;
    },

    addParkingLotImage: async (_, { id, imageUrl }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const parkingLot = await ParkingLot.findById(id);
      if (!parkingLot) throw new Error("Tempat parkir tidak ditemukan");

      if (parkingLot.ownerId.toString() !== user._id && user.role !== "admin") {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return await ParkingLot.update(id, {
        images: [...parkingLot.images, imageUrl]
      });
    },

    removeParkingLotImage: async (_, { id, imageUrl }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const parkingLot = await ParkingLot.findById(id);
      if (!parkingLot) throw new Error("Tempat parkir tidak ditemukan");

      if (parkingLot.ownerId.toString() !== user._id && user.role !== "admin") {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return await ParkingLot.update(id, {
        images: parkingLot.images.filter(img => img !== imageUrl)
      });
    },

    updateParkingLotRating: async (_, { id, rating }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const parkingLot = await ParkingLot.findById(id);
      if (!parkingLot) throw new Error("Tempat parkir tidak ditemukan");

      // Validasi rating
      if (rating < 1 || rating > 5) {
        throw new Error("Rating harus antara 1-5");
      }

      return await ParkingLot.updateRating(id, rating);
    }
  }
}; 