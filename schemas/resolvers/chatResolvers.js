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
    sender_id: (chat) => chat.user_id || chat.sender_id,
    sender: async (chat) => {
      try {
        return await User.findById(chat.user_id || chat.sender_id);
      } catch (error) {
        console.error("Error fetching sender:", error);
        return null;
      }
    },
    room: async (chat) => {
      try {
        return await Room.findById(chat.room_id);
      } catch (error) {
        console.error("Error fetching room:", error);
        return null;
      }
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
      if (!user) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const { room_id, message, message_type = "text" } = input;

      try {
        // Validate room exists and user has access
        const room = await Room.findById(room_id);
        if (!room) {
          throw new GraphQLError("Room not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        const userRoom = await UserRoom.findByUserAndRoom(user._id, room_id);
        if (!userRoom) {
          throw new GraphQLError("Access denied to this room", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        // Create message
        const chat = await Chat.create({
          user_id: user._id,
          room_id,
          message: message.trim(),
          message_type,
        });

        // Populate sender data for subscription
        const chatWithSender = {
          ...chat,
          sender_id: chat.user_id,
          sender: await User.findById(user._id),
          room: room,
        };

        console.log(`Publishing message to room ${room_id}:`, {
          messageId: chat._id,
          message: message,
          senderId: user._id,
        });

        // Enhanced subscription publishing with multiple event types
        try {
          // Primary subscription - specific to room
          await pubsub.publish(`MESSAGE_RECEIVED_${room_id}`, {
            messageReceived: chatWithSender,
          });

          // Secondary subscription - also for room (fallback)
          await pubsub.publish(`MESSAGE_SENT_${room_id}`, {
            messageSent: chatWithSender,
          });

          // Room-level update for all participants
          const participants = await UserRoom.findRoomUsers(room_id);
          for (const participant of participants) {
            if (participant.user_id.toString() !== user._id.toString()) {
              await pubsub.publish(
                `ROOM_MESSAGE_UPDATE_${participant.user_id}`,
                {
                  roomMessageUpdate: chatWithSender,
                }
              );
            }
          }

          console.log("All subscriptions published successfully");
        } catch (subError) {
          console.error("Subscription publish error:", subError);
          // Don't throw - message was created successfully
        }

        return chatWithSender;
      } catch (error) {
        console.error("Error sending message:", error);
        throw error;
      }
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
      subscribe: async (_, { room_id }, { user, connection }) => {
        console.log(
          `Setting up MESSAGE_RECEIVED subscription for room ${room_id}, user ${user?._id}`
        );

        if (!user) {
          throw new GraphQLError("Authentication required for subscription", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        if (!room_id) {
          throw new GraphQLError("Room ID is required", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        // Validate user has access to room
        try {
          const userRoom = await UserRoom.findByUserAndRoom(user._id, room_id);
          if (!userRoom) {
            throw new GraphQLError("Access denied to this room", {
              extensions: { code: "FORBIDDEN" },
            });
          }
        } catch (error) {
          console.error("Room access validation error:", error);
          throw error;
        }

        console.log(
          `User ${user._id} successfully subscribed to MESSAGE_RECEIVED_${room_id}`
        );
        return pubsub.asyncIterator([`MESSAGE_RECEIVED_${room_id}`]);
      },
      resolve: (payload, args, context) => {
        console.log("MESSAGE_RECEIVED resolve payload:", payload);
        return payload.messageReceived;
      },
    },

    messageSent: {
      subscribe: async (_, { room_id }, { user }) => {
        console.log(
          `Setting up MESSAGE_SENT fallback subscription for room ${room_id}, user ${user?._id}`
        );

        if (!user) {
          throw new GraphQLError("Authentication required for subscription", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        if (!room_id) {
          throw new GraphQLError("Room ID is required", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        // Validate user has access to room
        try {
          const userRoom = await UserRoom.findByUserAndRoom(user._id, room_id);
          if (!userRoom) {
            throw new GraphQLError("Access denied to this room", {
              extensions: { code: "FORBIDDEN" },
            });
          }
        } catch (error) {
          console.error("Room access validation error:", error);
          throw error;
        }

        console.log(
          `User ${user._id} successfully subscribed to MESSAGE_SENT_${room_id}`
        );
        return pubsub.asyncIterator([`MESSAGE_SENT_${room_id}`]);
      },
      resolve: (payload) => {
        console.log("MESSAGE_SENT resolve payload:", payload);
        return payload.messageSent;
      },
    },

    roomMessageUpdate: {
      subscribe: async (_, { user_id }, { user }) => {
        console.log(
          `Setting up ROOM_MESSAGE_UPDATE subscription for user ${user_id}`
        );

        if (!user) {
          throw new GraphQLError("Authentication required for subscription", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        }

        // Only allow users to subscribe to their own updates
        if (user._id.toString() !== user_id) {
          throw new GraphQLError("Can only subscribe to your own updates", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        console.log(
          `User ${user._id} successfully subscribed to ROOM_MESSAGE_UPDATE_${user_id}`
        );
        return pubsub.asyncIterator([`ROOM_MESSAGE_UPDATE_${user_id}`]);
      },
      resolve: (payload) => {
        console.log("ROOM_MESSAGE_UPDATE resolve payload:", payload);
        return payload.roomMessageUpdate;
      },
    },
  },
};
