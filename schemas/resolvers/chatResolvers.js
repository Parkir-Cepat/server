import { Chat } from "../../models/Chat.js";
import { User } from "../../models/User.js";
import { Booking } from "../../models/Booking.js";
import { ParkingLot } from "../../models/ParkingLot.js";
import { GraphQLError } from "graphql";
import { PubSub } from "graphql-subscriptions";

const pubsub = new PubSub();

export const chatResolvers = {
  Chat: {
    sender: async (chat) => {
      return await User.findById(chat.senderId);
    },
    receiver: async (chat) => {
      return await User.findById(chat.receiverId);
    },
    booking: async (chat) => {
      if (!chat.bookingId) return null;
      return await Booking.findById(chat.bookingId);
    }
  },

  Query: {
    getChatHistory: async (_, { userId, limit }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      return await Chat.getHistory(user._id, userId, limit);
    },

    getBookingChats: async (_, { bookingId }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const booking = await Booking.findById(bookingId);
      if (!booking) throw new Error("Booking tidak ditemukan");

      // Validasi akses
      if (booking.userId.toString() !== user._id) {
        const parkingLot = await ParkingLot.findById(booking.parkingLotId);
        if (parkingLot.ownerId.toString() !== user._id) {
          throw new GraphQLError("Anda tidak memiliki akses", {
            extensions: { code: 'FORBIDDEN' }
          });
        }
      }

      return await Chat.getByBooking(bookingId);
    },

    getChatParticipants: async (_, __, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      return await Chat.getParticipants(user._id);
    },

    getUnreadMessages: async (_, __, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      return await Chat.getUnread(user._id);
    }
  },

  Mutation: {
    sendMessage: async (_, { input }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const { receiverId, message, bookingId } = input;

      // Validasi receiver
      const receiver = await User.findById(receiverId);
      if (!receiver) throw new Error("Penerima pesan tidak ditemukan");

      // Validasi booking jika ada
      if (bookingId) {
        const booking = await Booking.findById(bookingId);
        if (!booking) throw new Error("Booking tidak ditemukan");

        // Validasi akses ke booking
        if (booking.userId.toString() !== user._id) {
          const parkingLot = await ParkingLot.findById(booking.parkingLotId);
          if (parkingLot.ownerId.toString() !== user._id) {
            throw new GraphQLError("Anda tidak memiliki akses ke booking ini", {
              extensions: { code: 'FORBIDDEN' }
            });
          }
        }
      }

      // Buat pesan
      const chat = await Chat.create({
        senderId: user._id,
        receiverId,
        bookingId,
        message,
        read: false
      });

      // Publish event untuk subscription
      pubsub.publish("MESSAGE_RECEIVED", {
        messageReceived: chat
      });

      return chat;
    },

    markMessageAsRead: async (_, { messageId }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const chat = await Chat.findById(messageId);
      if (!chat) throw new Error("Pesan tidak ditemukan");

      // Validasi penerima pesan
      if (chat.receiverId.toString() !== user._id) {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const updatedChat = await Chat.markAsRead(messageId);

      // Publish event untuk subscription
      pubsub.publish("MESSAGE_READ", {
        messageRead: updatedChat
      });

      return updatedChat;
    },

    markAllMessagesAsRead: async (_, { senderId }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      await Chat.markAllAsRead(senderId, user._id);
      return true;
    }
  },

  Subscription: {
    messageReceived: {
      subscribe: (_, { userId }) => {
        return pubsub.asyncIterator(["MESSAGE_RECEIVED"]);
      }
    },
    messageRead: {
      subscribe: (_, { userId }) => {
        return pubsub.asyncIterator(["MESSAGE_READ"]);
      }
    }
  }
}; 