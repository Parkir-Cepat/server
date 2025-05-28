import { Room } from "../../models/Room.js";
import { UserRoom } from "../../models/UserRoom.js";
import { User } from "../../models/User.js";
import { GraphQLError } from "graphql";

export const roomResolvers = {
  Room: {    participants: async (room) => {
      const userRooms = await UserRoom.findByRoom(room._id);
      const userIds = userRooms.map(ur => ur.user_id);
      return await User.findByIds(userIds);
    },
    participant_count: async (room) => {
      return await UserRoom.countByRoom(room._id);
    }
  },

  Query: {
    getRoom: async (_, { id }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const room = await Room.findById(id);
      if (!room) throw new Error("Room tidak ditemukan");

      // Pastikan user adalah member room
      const userRoom = await UserRoom.findByUserAndRoom(user._id, id);
      if (!userRoom) {
        throw new GraphQLError("Anda tidak memiliki akses ke room ini", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return room;
    },

    getMyRooms: async (_, __, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const userRooms = await UserRoom.findByUser(user._id);
      const roomIds = userRooms.map(ur => ur.room_id);
      return await Room.findByIds(roomIds);
    }
  },

  Mutation: {
    createRoom: async (_, { input }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const { nameRoom, participants } = input;

      // Buat room baru
      const room = await Room.create({ nameRoom });

      // Tambahkan creator sebagai participant
      await UserRoom.create({
        user_id: user._id,
        room_id: room._id
      });

      // Tambahkan participants lain jika ada
      if (participants && participants.length > 0) {
        for (const participantId of participants) {
          // Validasi participant exists
          const participant = await User.findById(participantId);
          if (participant) {
            await UserRoom.create({
              user_id: participantId,
              room_id: room._id
            });
          }
        }
      }

      return room;
    },

    updateRoom: async (_, { id, input }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const room = await Room.findById(id);
      if (!room) throw new Error("Room tidak ditemukan");

      // Pastikan user adalah member room
      const userRoom = await UserRoom.findByUserAndRoom(user._id, id);
      if (!userRoom) {
        throw new GraphQLError("Anda tidak memiliki akses ke room ini", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return await Room.update(id, input);
    },    addParticipants: async (_, { room_id, participant_ids }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const room = await Room.findById(room_id);
      if (!room) throw new Error("Room tidak ditemukan");

      // Pastikan user adalah member room
      const userRoom = await UserRoom.findByUserAndRoom(user._id, room_id);
      if (!userRoom) {
        throw new GraphQLError("Anda tidak memiliki akses ke room ini", {
          extensions: { code: 'FORBIDDEN' }
        });
      }      // Process each participant
      for (const participant_id of participant_ids) {
        // Pastikan user yang akan ditambah exists
        const newParticipant = await User.findById(participant_id);
        if (!newParticipant) throw new Error(`User dengan ID ${participant_id} tidak ditemukan`);
        
        // Cek apakah user sudah menjadi participant
        const existingUserRoom = await UserRoom.findByUserAndRoom(participant_id, room_id);
        if (!existingUserRoom) {
          // Add user to room if they're not already a participant
          await UserRoom.create({ user_id: participant_id, room_id });
        }
      }

      return room;
    },    removeParticipant: async (_, { room_id, user_id }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const room = await Room.findById(room_id);
      if (!room) throw new Error("Room tidak ditemukan");

      // Pastikan user adalah member room atau user yang akan dihapus adalah dirinya sendiri
      const userRoom = await UserRoom.findByUserAndRoom(user._id, room_id);
      if (!userRoom && user_id !== user._id.toString()) {
        throw new GraphQLError("Anda tidak memiliki akses ke room ini", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      await UserRoom.removeByUserAndRoom(user_id, room_id);
      return room;
    },

    deleteRoom: async (_, { id }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const room = await Room.findById(id);
      if (!room) throw new Error("Room tidak ditemukan");

      // Pastikan user adalah member room (atau admin)
      const userRoom = await UserRoom.findByUserAndRoom(user._id, id);
      if (!userRoom && user.role !== "admin") {
        throw new GraphQLError("Anda tidak memiliki akses ke room ini", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      // Hapus semua user-room relationships
      await UserRoom.removeByRoom(id);
      
      // Hapus room
      await Room.delete(id);
      
      return true;
    }
  }
};
