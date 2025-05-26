import { Notification } from '../../models/Notification.js';
import { ensureAuth } from '../../helpers/jwt.js';
import { subscribe, EVENTS } from '../../helpers/pubsub.js';
import { GraphQLScalarType } from 'graphql';
import { Kind } from 'graphql/language/index.js';

// Custom scalar untuk JSON
const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON custom scalar type',
  serialize(value) {
    return value;
  },
  parseValue(value) {
    return value;
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.OBJECT) {
      return ast.value;
    }
    return null;
  }
});

export const notificationResolvers = {
  JSON: JSONScalar,

  Query: {
    // Mendapatkan notifikasi user
    getMyNotifications: async (_, { limit }, { user }) => {
      ensureAuth(user);
      return await Notification.findByUserId(user._id, limit);
    },

    // Mendapatkan jumlah notifikasi yang belum dibaca
    getUnreadNotificationCount: async (_, __, { user }) => {
      ensureAuth(user);
      return await Notification.getUnreadCount(user._id);
    }
  },

  Mutation: {
    // Tandai notifikasi sebagai sudah dibaca
    markNotificationAsRead: async (_, { id }, { user }) => {
      ensureAuth(user);
      await Notification.markAsRead(id, user._id);
      return true;
    },

    // Tandai semua notifikasi sebagai sudah dibaca
    markAllNotificationsAsRead: async (_, __, { user }) => {
      ensureAuth(user);
      await Notification.markAllAsRead(user._id);
      return true;
    }
  },

  Subscription: {
    // Subscription untuk notifikasi baru
    notificationReceived: {
      subscribe: (_, __, { user }) => {
        ensureAuth(user);
        return subscribe(`${EVENTS.NOTIFICATION.NEW}_${user._id}`);
      }
    }
  }
}; 