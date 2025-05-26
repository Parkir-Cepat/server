import { ObjectId } from 'mongodb';
import { Booking } from '../../models/Booking.js';
import { ParkingLot } from '../../models/ParkingLot.js';
import { User } from '../../models/User.js';
import { ensureAuth } from '../../helpers/jwt.js';
import { publish, subscribe, EVENTS } from '../../helpers/pubsub.js';
import { getDB } from '../../config/db.js';

export const bookingResolvers = {
  Query: {
    // Mendapatkan booking berdasarkan ID
    getBooking: async (_, { id }, { user }) => {
      ensureAuth(user);
      return await Booking.findById(id);
    },

    // Mendapatkan booking aktif user
    getMyActiveBookings: async (_, __, { user }) => {
      ensureAuth(user);
      return await Booking.getActiveBookings(user._id);
    },

    // Mendapatkan riwayat booking user
    getMyBookingHistory: async (_, __, { user }) => {
      ensureAuth(user);
      return await Booking.getBookingHistory(user._id);
    },

    // Mendapatkan booking untuk parking lot tertentu
    getParkingLotBookings: async (_, { parkingLotId }, { user }) => {
      ensureAuth(user);
      
      const parkingLot = await ParkingLot.findById(parkingLotId);
      if (!parkingLot) throw new Error('Parking lot tidak ditemukan');
      
      // Hanya owner yang bisa melihat booking parking lotnya
      if (parkingLot.ownerId.toString() !== user._id) {
        throw new Error('Anda tidak memiliki akses');
      }
      
      const db = getDB();
      return await db.collection('bookings')
        .find({ parkingLotId: new ObjectId(parkingLotId) })
        .sort({ startTime: -1 })
        .toArray();
    }
  },

  Mutation: {
    // Membuat booking baru
    createBooking: async (_, { input }, { user }) => {
      ensureAuth(user);

      const booking = await Booking.create({
        ...input,
        userId: user._id
      });

      // Publish event untuk subscription
      await publish(EVENTS.BOOKING.CREATED, {
        bookingCreated: booking,
        userId: user._id
      });

      return booking;
    },

    // Cancel booking
    cancelBooking: async (_, { id }, { user }) => {
      ensureAuth(user);

      const booking = await Booking.findById(id);
      if (!booking) throw new Error('Booking tidak ditemukan');
      
      if (booking.userId.toString() !== user._id) {
        throw new Error('Anda tidak memiliki akses');
      }

      const updatedBooking = await Booking.updateStatus(id, 'cancelled');

      // Publish event untuk subscription
      await publish(EVENTS.BOOKING.UPDATED, {
        bookingUpdated: updatedBooking,
        userId: booking.userId
      });

      return updatedBooking;
    },

    // Confirm booking
    confirmBooking: async (_, { id }, { user }) => {
      ensureAuth(user);

      const booking = await Booking.findById(id);
      if (!booking) throw new Error('Booking tidak ditemukan');

      const updatedBooking = await Booking.updateStatus(id, 'confirmed');

      // Publish event untuk subscription
      await publish(EVENTS.BOOKING.UPDATED, {
        bookingUpdated: updatedBooking,
        userId: booking.userId
      });

      return updatedBooking;
    },

    // Perpanjang durasi booking
    extendBooking: async (_, { id, additionalDuration }, { user }) => {
      ensureAuth(user);

      const booking = await Booking.findById(id);
      if (!booking) throw new Error('Booking tidak ditemukan');

      // Hitung biaya tambahan
      const parkingLot = await ParkingLot.findById(booking.parkingLotId);
      const additionalCost = parkingLot.tariff * additionalDuration;

      const updatedBooking = await Booking.extend(id, additionalDuration, additionalCost);

      // Publish event untuk subscription
      await publish(EVENTS.BOOKING.UPDATED, {
        bookingUpdated: updatedBooking,
        userId: booking.userId
      });

      return updatedBooking;
    }
  },

  Subscription: {
    // Subscription untuk status booking berubah
    bookingStatusChanged: {
      subscribe: (_, { parkingLotId }, { user }) => {
        ensureAuth(user);
        return subscribe(EVENTS.BOOKING.UPDATED);
      }
    }
  },

  Booking: {
    // Resolve user yang membuat booking
    user: async (booking) => {
      return await User.findById(booking.userId);
    },

    // Resolve parking lot yang dibooking
    parkingLot: async (booking) => {
      return await ParkingLot.findById(booking.parkingLotId);
    }
  }
}; 