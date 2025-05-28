import { userResolvers } from './userResolvers.js';
import { parkingResolvers } from './parkingResolvers.js';
import { bookingResolvers } from './bookingResolvers.js';
import { transactionResolvers } from './transactionResolvers.js';
import { roomResolvers } from './roomResolvers.js';
import { chatResolvers } from './chatResolvers.js';
import notificationResolvers from './notificationResolvers.js';

const resolvers = {
  JSON: notificationResolvers.JSON,
  Query: {
    ...userResolvers.Query,
    ...parkingResolvers.Query,
    ...bookingResolvers.Query,
    ...transactionResolvers.Query,
    ...roomResolvers.Query,
    ...chatResolvers.Query,
    ...notificationResolvers.Query
  },
  Mutation: {
    ...userResolvers.Mutation,
    ...parkingResolvers.Mutation,
    ...bookingResolvers.Mutation,
    ...transactionResolvers.Mutation,
    ...roomResolvers.Mutation,
    ...chatResolvers.Mutation,
    ...notificationResolvers.Mutation
  },
  Subscription: {
    ...bookingResolvers.Subscription,
    ...transactionResolvers.Subscription,
    ...chatResolvers.Subscription,
    ...notificationResolvers.Subscription
  },
  User: userResolvers.User,
  Parking: parkingResolvers.Parking,
  Booking: bookingResolvers.Booking,
  Transaction: transactionResolvers.Transaction,
  Room: roomResolvers.Room,
  Chat: chatResolvers.Chat
};

export default resolvers;