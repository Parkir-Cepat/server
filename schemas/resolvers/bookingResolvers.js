import { ObjectId } from 'mongodb';
import { Booking } from '../../models/Booking.js';
import { ParkingLot } from '../../models/ParkingLot.js';
import { User } from '../../models/User.js';
import { ensureAuth } from '../../helpers/jwt.js';
import { publish, subscribe, EVENTS } from '../../helpers/pubsub.js';
import { getDB } from '../../config/db.js';
import { verifyQRToken } from '../../helpers/qrcode.js';

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
      
      if (booking.userId.toString() !== user._id.toString()) {
        throw new Error('Anda tidak memiliki akses');
      }

      const updatedBooking = await Booking.cancel(id);

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
    },    // Generate QR Code untuk booking
    generateBookingQR: async (_, { bookingId }, { user }) => {
      ensureAuth(user);

      const booking = await Booking.findById(bookingId);
      if (!booking) throw new Error('Booking tidak ditemukan');

      // Pastikan user yang buat booking atau owner parking lot
      const parkingLot = await ParkingLot.findById(booking.parkingLotId);
      if (booking.userId.toString() !== user._id.toString() && 
          parkingLot.ownerId.toString() !== user._id.toString()) {
        throw new Error('Anda tidak memiliki akses');
      }

      return await Booking.generateQRCode(bookingId);
    },

    // Verify QR Code
    verifyQRCode: async (_, { qrToken }, { user }) => {
      ensureAuth(user);

      try {
        const decoded = verifyQRToken(qrToken);
        const booking = await Booking.findById(decoded.bookingId);

        if (!booking) {
          return {
            isValid: false,
            booking: null,
            message: 'Booking tidak ditemukan'
          };
        }

        // Pastikan QR code masih valid berdasarkan status booking
        if (booking.status !== 'confirmed') {
          return {
            isValid: false,
            booking,
            message: 'Booking tidak valid atau sudah selesai'
          };
        }

        return {
          isValid: true,
          booking,
          message: 'QR Code valid'
        };
      } catch (error) {
        return {
          isValid: false,
          booking: null,
          message: error.message
        };
      }
    },

    // Generate QR Code untuk entry/exit parking
    generateParkingAccessQR: async (_, { bookingId, type }, { user }) => {
      ensureAuth(user);

      const booking = await Booking.findById(bookingId);
      if (!booking) throw new Error('Booking tidak ditemukan');      // Pastikan user yang buat booking atau owner parking lot
      const parkingLot = await ParkingLot.findById(booking.parkingLotId);
      if (booking.userId.toString() !== user._id.toString() && 
          parkingLot.ownerId.toString() !== user._id.toString()) {
        throw new Error('Anda tidak memiliki akses');
      }

      if (!['entry', 'exit'].includes(type)) {
        throw new Error('Type harus entry atau exit');
      }

      return await Booking.generateAccessQR(bookingId, type);
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