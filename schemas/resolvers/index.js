import { userResolvers } from './userResolvers.js';
import { parkingLotResolvers } from './parkingLotResolvers.js';
import { bookingResolvers } from './bookingResolvers.js';
import { paymentResolvers } from './paymentResolvers.js';
import { chatResolvers } from './chatResolvers.js';

const resolvers = {
  Query: {
    ...userResolvers.Query,
    ...parkingLotResolvers.Query,
    ...bookingResolvers.Query,
    ...paymentResolvers.Query,
    ...chatResolvers.Query
  },
  Mutation: {
    ...userResolvers.Mutation,
    ...parkingLotResolvers.Mutation,
    ...bookingResolvers.Mutation,
    ...paymentResolvers.Mutation,
    ...chatResolvers.Mutation
  },
  Subscription: {
    ...bookingResolvers.Subscription,
    ...paymentResolvers.Subscription,
    ...chatResolvers.Subscription
  },
  User: userResolvers.User,
  ParkingLot: parkingLotResolvers.ParkingLot,
  Booking: bookingResolvers.Booking,
  Payment: paymentResolvers.Payment,
  SaldoTransaction: paymentResolvers.SaldoTransaction,
  Chat: chatResolvers.Chat
};

export default resolvers; 