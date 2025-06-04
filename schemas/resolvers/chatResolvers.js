import { Chat } from "../../models/Chat.js";
import { Room } from "../../models/Room.js";
import { UserRoom } from "../../models/UserRoom.js";
import { User } from "../../models/User.js";
import { GraphQLError } from "graphql";
import { PubSub } from "graphql-subscriptions";
import {
  AuthenticationError,
  ForbiddenError,
  UserInputError,
} from "apollo-server-express";
import { ObjectId } from "mongodb";

const pubsub = new PubSub();

export const chatResolvers = {
  Chat: {
    sender_id: (chat) => chat.user_id,
    sender: async (chat) => {
      return await User.findById(chat.user_id || chat.sender_id);
    },
    room: async (chat) => {
      return await Room.findById(chat.room_id);
    },
    created_at: (chat) =>
      chat.created_at?.toISOString() || new Date().toISOString(),
    updated_at: (chat) =>
      chat.updated_at?.toISOString() || new Date().toISOString(),
    message_type: (chat) => chat.message_type || "text",
    read_by: (chat) => chat.read_by || [],
  },

  Query: {
    async getRoomMessages(parent, { room_id, limit = 50 }, { user }) {
      if (!user) {
        throw new AuthenticationError("You must be logged in to view messages");
      }

      // Validate room_id
      if (!room_id) {
        throw new UserInputError("Room ID is required");
      }

      // Validate ObjectId format
      if (!ObjectId.isValid(room_id)) {
        throw new UserInputError("Invalid room ID format");
      }

      try {
        // Check if user has access to this room
        const userRoom = await UserRoom.findByUserAndRoom(user._id, room_id);
        if (!userRoom) {
          throw new ForbiddenError("You do not have access to this room");
        }

        // Get messages from the room
        const messages = await Chat.getRoomChats(room_id, limit);
        return messages;
      } catch (error) {
        console.error("Error getting room messages:", error);
        throw error;
      }
    },

    getMyRecentChats: async (_, __, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      return await Chat.getRecentChats(user._id);
    },
  },

  Mutation: {
    sendMessage: async (_, { input }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const { room_id, message } = input;

      // Validasi room
      const room = await Room.findById(room_id);
      if (!room) throw new Error("Room tidak ditemukan");

      // Pastikan user adalah member room
      const userRoom = await UserRoom.findByUserAndRoom(user._id, room_id);
      if (!userRoom) {
        throw new GraphQLError("Anda tidak memiliki akses ke room ini", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      // Buat pesan
      const chat = await Chat.create({
        user_id: user._id,
        room_id,
        message,
      });

      // Populate sender data untuk subscription
      const chatWithSender = {
        ...chat,
        sender: await User.findById(user._id),
        room: room,
      };

      // Enhanced subscription publishing dengan debugging
      console.log(`Publishing message to room ${room_id}:`, {
        messageId: chat._id,
        message: message,
        senderId: user._id,
        roomId: room_id,
      });

      // Publish ke semua subscriber di room ini
      pubsub.publish(`MESSAGE_RECEIVED_${room_id}`, {
        messageReceived: chatWithSender,
      });

      // Also publish general room update untuk refresh room list
      pubsub.publish(`ROOM_UPDATED_${user._id}`, {
        roomUpdated: room,
      });

      return chatWithSender;
    },

    markRoomMessagesAsRead: async (_, { room_id }, { user }) => {
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

      await Chat.markRoomAsRead(room_id, user._id);
      return true;
    },
  },

  Subscription: {
    messageReceived: {
      subscribe: (_, { room_id }, { user }) => {
        console.log(`User ${user?._id} subscribing to room ${room_id}`);

        if (!user) {
          throw new GraphQLError("Authentication required for subscription");
        }

        if (!room_id) {
          throw new GraphQLError("Room ID required for subscription");
        }

        return pubsub.asyncIterator([`MESSAGE_RECEIVED_${room_id}`]);
      },
      resolve: (payload) => {
        console.log("Message subscription payload:", payload);
        return payload.messageReceived;
      },
    },

    roomUpdated: {
      subscribe: (_, { user_id }, { user }) => {
        console.log(
          `User ${user?._id} subscribing to room updates for user ${user_id}`
        );

        if (!user) {
          throw new GraphQLError("Authentication required for subscription");
        }

        return pubsub.asyncIterator([`ROOM_UPDATED_${user_id}`]);
      },
      resolve: (payload) => {
        console.log("Room update subscription payload:", payload);
        return payload.roomUpdated;
      },
    },
  },
};
