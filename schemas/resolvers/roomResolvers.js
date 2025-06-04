import { Room } from "../../models/Room.js";
import { UserRoom } from "../../models/UserRoom.js";
import { User } from "../../models/User.js";
import { GraphQLError } from "graphql";

export const roomResolvers = {
  Room: {
    name: (room) => room.nameRoom || "General Chat",
    type: (room) => room.type || "general",
    privacy: (room) => room.privacy || "public", // Add this line
    creator: async (room) => {
      if (!room.creator_id) return null;
      return await User.findById(room.creator_id);
    },
    is_full: async (room) => {
      if (!room.max_participants) return false;
      const count = await UserRoom.countByRoom(room._id);
      return count >= room.max_participants;
    },
    participants: async (room) => {
      const userRooms = await UserRoom.findByRoomId(room._id);
      const userIds = userRooms.map((ur) => ur.user_id);
      return await User.findByIds(userIds);
    },
    participant_count: async (room) => {
      return await UserRoom.countByRoom(room._id);
    },
  },

  Query: {
    getRoom: async (_, { id }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const room = await Room.findById(id);
      if (!room) throw new Error("Room tidak ditemukan");

      // Pastikan user adalah member room
      const userRoom = await UserRoom.findByUserAndRoom(user._id, id);
      if (!userRoom) {
        throw new GraphQLError("Anda tidak memiliki akses ke room ini", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      return room;
    },
    getMyRooms: async (_, __, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const userRooms = await UserRoom.findByUserId(user._id);
      const roomIds = userRooms.map((ur) => ur.room_id);
      return await Room.findByIds(roomIds);
    },
    getPublicRooms: async (_, { limit, parking_id }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      return await Room.findPublicRooms(limit, parking_id);
    },
    getPrivateRoomWithUser: async (_, { user_id, parking_id }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      return await Room.findPrivateRoomBetweenUsers(
        user._id,
        user_id,
        parking_id
      );
    },
    rooms: async () => {
      try {
        const rooms = await Room.find({}).toArray();
        return rooms;
      } catch (error) {
        console.error("Error fetching rooms:", error);
        throw new GraphQLError("Failed to fetch rooms");
      }
    },
  },

  Mutation: {
    createRoom: async (_, { input }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const { nameRoom, participants } = input;
      // Extract type from input, default to 'general'
      const { name, type } = input;
      const roomName = name || nameRoom;

      // Buat room baru
      const room = await Room.create({
        nameRoom: roomName,
        type,
        privacy: input.privacy || "public",
        creator_id: user._id,
        max_participants: input.max_participants,
        parking_id: input.parking_id,
      });

      // Tambahkan creator sebagai participant
      await UserRoom.create({
        user_id: user._id,
        room_id: room._id,
      });

      // Tambahkan participants lain jika ada
      if (input.participant_ids && input.participant_ids.length > 0) {
        for (const participantId of input.participant_ids) {
          // Validasi participant exists
          const participant = await User.findById(participantId);
          if (participant) {
            await UserRoom.create({
              user_id: participantId,
              room_id: room._id,
            });
          }
        }
      }

      return room;
    },
    createPrivateRoom: async (_, { input }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const { participant_id, parking_id } = input;

      // Cek apakah sudah ada room private antara kedua user ini
      const existingRoom = await Room.findPrivateRoomBetweenUsers(
        user._id,
        participant_id,
        parking_id
      );
      if (existingRoom) {
        return existingRoom;
      }

      // Validasi participant exists
      const participant = await User.findById(participant_id);
      if (!participant) {
        throw new Error("User tidak ditemukan");
      }

      // Generate nama room untuk private chat
      const roomName = `Chat with ${participant.name}`;

      // Buat room private baru
      const room = await Room.create({
        nameRoom: roomName,
        type: "direct",
        privacy: "private",
        creator_id: user._id,
        max_participants: 2,
        parking_id,
      });

      // Tambahkan kedua user sebagai participants
      await UserRoom.create({
        user_id: user._id,
        room_id: room._id,
        role: "admin",
      });

      await UserRoom.create({
        user_id: participant_id,
        room_id: room._id,
        role: "member",
      });

      return room;
    },
    joinRoom: async (_, { input }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const { room_id } = input;
      const room = await Room.findById(room_id);
      if (!room) throw new Error("Room tidak ditemukan");

      // Cek apakah room adalah public
      if (room.privacy === "private") {
        throw new GraphQLError("Room ini bersifat private", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      // Cek apakah user sudah menjadi member
      const existingUserRoom = await UserRoom.findByUserAndRoom(
        user._id,
        room_id
      );
      if (existingUserRoom) {
        return room; // User sudah menjadi member
      }

      // Cek apakah room sudah penuh
      if (room.max_participants) {
        const currentCount = await UserRoom.countByRoom(room_id);
        if (currentCount >= room.max_participants) {
          throw new Error("Room sudah penuh");
        }
      }

      // Tambahkan user ke room
      await UserRoom.create({
        user_id: user._id,
        room_id: room_id,
        role: "member",
      });

      return room;
    },
    updateRoom: async (_, { id, input }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const room = await Room.findById(id);
      if (!room) throw new Error("Room tidak ditemukan");

      // Pastikan user adalah member room
      const userRoom = await UserRoom.findByUserAndRoom(user._id, id);
      if (!userRoom) {
        throw new GraphQLError("Anda tidak memiliki akses ke room ini", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      return await Room.update(id, input);
    },
    addParticipants: async (_, { room_id, participant_ids }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const room = await Room.findById(room_id);
      if (!room) throw new Error("Room tidak ditemukan");

      // Pastikan user adalah member room
      const userRoom = await UserRoom.findByUserAndRoom(user._id, room_id);
      if (!userRoom) {
        throw new GraphQLError("Anda tidak memiliki akses ke room ini", {
          extensions: { code: "FORBIDDEN" },
        });
      }
      // Process each participant
      for (const participant_id of participant_ids) {
        // Pastikan user yang akan ditambah exists
        const newParticipant = await User.findById(participant_id);
        if (!newParticipant)
          throw new Error(`User dengan ID ${participant_id} tidak ditemukan`);

        // Cek apakah user sudah menjadi participant
        const existingUserRoom = await UserRoom.findByUserAndRoom(
          participant_id,
          room_id
        );
        if (!existingUserRoom) {
          // Add user to room if they're not already a participant
          await UserRoom.create({ user_id: participant_id, room_id });
        }
      }

      return room;
    },
    removeParticipant: async (_, { room_id, user_id }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const room = await Room.findById(room_id);
      if (!room) throw new Error("Room tidak ditemukan");

      // Pastikan user adalah member room atau user yang akan dihapus adalah dirinya sendiri
      const userRoom = await UserRoom.findByUserAndRoom(user._id, room_id);
      if (!userRoom && user_id !== user._id.toString()) {
        throw new GraphQLError("Anda tidak memiliki akses ke room ini", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      await UserRoom.removeByUserAndRoom(user_id, room_id);
      return room;
    },
    deleteRoom: async (_, { id }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const room = await Room.findById(id);
      if (!room) throw new Error("Room tidak ditemukan");

      // Pastikan user adalah member room (atau admin)
      const userRoom = await UserRoom.findByUserAndRoom(user._id, id);
      if (!userRoom && user.role !== "admin") {
        throw new GraphQLError("Anda tidak memiliki akses ke room ini", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      // Hapus semua user-room relationships
      await UserRoom.removeByRoom(id);

      // Hapus room
      await Room.delete(id);

      return true;
    },
    leaveRoom: async (_, { room_id }, { user }) => {
      try {
        if (!user)
          throw new GraphQLError("Anda harus login terlebih dahulu", {
            extensions: { code: "UNAUTHENTICATED" },
          });

        // Pastikan user adalah member room
        const userRoom = await UserRoom.findByUserAndRoom(user._id, room_id);
        if (!userRoom) {
          throw new GraphQLError("Anda tidak memiliki akses ke room ini", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        // Hapus user dari room
        await UserRoom.delete(user._id, room_id);

        // Cek apakah masih ada peserta di room
        const remaining = await UserRoom.countByRoom(room_id);
        if (remaining === 0) {
          // Hapus room jika tidak ada peserta
          await Room.delete(room_id);
        }

        return true;
      } catch (error) {
        throw new GraphQLError(error.message || "Gagal keluar dari room", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
  },
};
