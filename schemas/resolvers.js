import Booking from "../models/Booking";
import User from "../models/User";
import { AuthenticationError } from "apollo-server-express";
import { ensureAuth } from "../utils/auth";

const resolvers = {
  Query: {
    // ...existing queries
  },

  Mutation: {
    // ...existing mutations

    processBookingPayment: async (_, { bookingId }, { user }) => {
      ensureAuth(user);

      try {
        const booking = await Booking.processPayment(bookingId, user._id);

        return {
          success: true,
          message: "Payment successful! Your booking is confirmed.",
          booking: booking,
        };
      } catch (error) {
        return {
          success: false,
          message: error.message,
          booking: null,
        };
      }
    },

    // ...existing mutations
  },
};

export default resolvers;
