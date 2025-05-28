import { Chat } from "../../models/Chat.js";
import { Room } from "../../models/Room.js";
import { UserRoom } from "../../models/UserRoom.js";
import { User } from "../../models/User.js";
import { GraphQLError } from "graphql";
import { PubSub } from "graphql-subscriptions";

const pubsub = new PubSub();

export const chatResolvers = {
  Chat: {
    sender: async (chat) => {
      return await User.findById(chat.user_id || chat.sender_id);
    },
    room: async (chat) => {
      return await Room.findById(chat.room_id);
    }
  },  Query: {
    getRoomMessages: async (_, { room_id, limit, offset }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      // Pastikan user adalah member room
      const userRoom = await UserRoom.findByUserAndRoom(user._id, room_id);
      if (!userRoom) {
        throw new GraphQLError("Anda tidak memiliki akses ke room ini", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return await Chat.getRoomChats(room_id, limit);
    },

    getMyRecentChats: async (_, __, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      return await Chat.getRecentChats(user._id);
    }  },

  Mutation: {
    sendMessage: async (_, { input }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const { room_id, message } = input;

      // Validasi room
      const room = await Room.findById(room_id);
      if (!room) throw new Error("Room tidak ditemukan");

      // Pastikan user adalah member room
      const userRoom = await UserRoom.findByUserAndRoom(user._id, room_id);
      if (!userRoom) {
        throw new GraphQLError("Anda tidak memiliki akses ke room ini", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      // Buat pesan
      const chat = await Chat.create({
        user_id: user._id,
        room_id,
        message
      });

      // Publish event untuk subscription
      pubsub.publish("MESSAGE_RECEIVED", {
        messageReceived: chat,
        roomId: room_id
      });      return chat;
    },

    markRoomMessagesAsRead: async (_, { room_id }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      // Pastikan user adalah member room
      const userRoom = await UserRoom.findByUserAndRoom(user._id, room_id);
      if (!userRoom) {
        throw new GraphQLError("Anda tidak memiliki akses ke room ini", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      await Chat.markRoomAsRead(room_id, user._id);
      return true;
    }
  },

  Subscription: {
    messageReceived: {
      subscribe: (_, { room_id }) => {
        return pubsub.asyncIterator(["MESSAGE_RECEIVED"]);
      }
    }
  }
};