import { ObjectId } from "mongodb";
import { Booking } from "../../models/Booking.js";
import { Parking } from "../../models/Parking.js";
import { User } from "../../models/User.js";
import { Transaction } from "../../models/Transaction.js";
import { ensureAuth } from "../../helpers/jwt.js";
import { publish, subscribe, EVENTS } from "../../helpers/pubsub.js";
import { getDB } from "../../config/db.js";
import { verifyQRToken } from "../../helpers/qrcode.js";
import { GraphQLError } from "graphql";
import { PubSub } from "graphql-subscriptions";

const pubsub = new PubSub();

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

    // Mendapatkan booking untuk parking tertentu
    getParkingBookings: async (_, { parking_id }, { user }) => {
      ensureAuth(user);

      const parking = await Parking.findById(parking_id);
      if (!parking) throw new Error("Parking tidak ditemukan");

      // Hanya owner yang bisa melihat booking parkingnya
      if (parking.owner_id.toString() !== user._id) {
        throw new Error("Anda tidak memiliki akses");
      }

      const db = getDB();
      return await db
        .collection("bookings")
        .find({ parking_id: new ObjectId(parking_id) })
        .sort({ created_at: -1 })
        .toArray();
    },
  },

  Mutation: {
    // Membuat booking baru
    createBooking: async (_, { input }, { user }) => {
      if (!user) {
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const { parking_id, vehicle_type, start_time, duration } = input;

      // Validasi input
      if (duration < 1) {
        throw new Error("Durasi parkir minimal 1 jam");
      }

      // Fix start_time parsing - handle different formats
      let startDateTime;
      if (start_time.includes("T") || start_time.includes("Z")) {
        // ISO format
        startDateTime = new Date(start_time);
      } else {
        // Time only format like "21:00"
        const today = new Date();
        const [hours, minutes] = start_time.split(":");
        startDateTime = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
          parseInt(hours),
          parseInt(minutes || 0)
        );

        // If time is in the past today, set it for tomorrow
        if (startDateTime < new Date()) {
          startDateTime.setDate(startDateTime.getDate() + 1);
        }
      }

      console.log("🔍 Parsed start_time:", {
        input: start_time,
        parsed: startDateTime,
        isValid: !isNaN(startDateTime.getTime()),
      });

      if (isNaN(startDateTime.getTime())) {
        throw new Error(
          "Format waktu tidak valid. Gunakan format ISO (2024-12-20T10:00:00.000Z) atau HH:MM (21:00)"
        );
      }

      try {
        // Get parking details untuk calculate cost
        const parking = await Parking.findById(parking_id);
        if (!parking) {
          throw new Error("Tempat parkir tidak ditemukan");
        }

        console.log("🔍 Debugging parking data:");
        console.log("Parking rates:", JSON.stringify(parking.rates, null, 2));
        console.log(
          "Parking pricing:",
          JSON.stringify(parking.pricing, null, 2)
        );
        console.log("Input vehicle_type:", vehicle_type);

        // Normalize vehicle type and find price
        let pricePerHour = null;
        let normalizedVehicleType = vehicle_type.toLowerCase();

        // Direct lookup in rates first
        if (parking.rates) {
          console.log("🔍 Checking rates object...");

          // Try direct match
          if (parking.rates[vehicle_type]) {
            pricePerHour = parking.rates[vehicle_type];
            console.log(
              `✅ Direct match in rates: ${vehicle_type} = ${pricePerHour}`
            );
          }
          // Try normalized match
          else if (parking.rates[normalizedVehicleType]) {
            pricePerHour = parking.rates[normalizedVehicleType];
            console.log(
              `✅ Normalized match in rates: ${normalizedVehicleType} = ${pricePerHour}`
            );
          }
          // Try common mappings
          else {
            const vehicleMapping = {
              car: ["car", "mobil", "cars", "automobile"],
              motorcycle: [
                "motorcycle",
                "motor",
                "bike",
                "sepeda_motor",
                "motorbike",
              ],
            };

            for (const [key, variants] of Object.entries(vehicleMapping)) {
              if (
                variants.includes(normalizedVehicleType) &&
                parking.rates[key]
              ) {
                pricePerHour = parking.rates[key];
                normalizedVehicleType = key;
                console.log(
                  `✅ Mapped ${vehicle_type} -> ${key} = ${pricePerHour}`
                );
                break;
              }
            }
          }
        }

        // Fallback to pricing array
        if (
          !pricePerHour &&
          parking.pricing &&
          Array.isArray(parking.pricing)
        ) {
          console.log("🔍 Checking pricing array...");

          const vehiclePricing = parking.pricing.find(
            (p) =>
              p.vehicle_type &&
              p.vehicle_type.toLowerCase() === normalizedVehicleType
          );

          if (vehiclePricing && vehiclePricing.price_per_hour) {
            pricePerHour = vehiclePricing.price_per_hour;
            console.log(
              `✅ Found in pricing array: ${vehiclePricing.vehicle_type} = ${pricePerHour}`
            );
          }
        }

        // Final error if no price found
        if (!pricePerHour) {
          const availableTypes = [];
          if (parking.rates) {
            availableTypes.push(...Object.keys(parking.rates));
          }
          if (parking.pricing) {
            availableTypes.push(...parking.pricing.map((p) => p.vehicle_type));
          }

          throw new Error(
            `Harga untuk "${vehicle_type}" tidak tersedia. Tipe kendaraan yang tersedia: ${availableTypes.join(
              ", "
            )}`
          );
        }

        const totalCost = pricePerHour * duration;
        console.log(
          `💰 Calculated cost: ${pricePerHour} x ${duration} hours = ${totalCost}`
        );

        // Check user balance
        const currentUser = await User.findById(user._id);
        if (currentUser.saldo < totalCost) {
          throw new Error(
            `Saldo tidak mencukupi. Dibutuhkan Rp ${totalCost.toLocaleString()}, saldo Anda Rp ${currentUser.saldo.toLocaleString()}`
          );
        }

        // Create booking with normalized vehicle type
        const booking = await Booking.create({
          user_id: user._id,
          parking_id,
          vehicle_type: normalizedVehicleType,
          start_time: startDateTime.toISOString(), // Use parsed datetime
          duration,
        });

        // Deduct user balance
        await User.updateSaldo(user._id, -totalCost);

        // Create payment transaction
        await Transaction.create({
          user_id: user._id,
          booking_id: booking._id,
          type: "payment",
          amount: totalCost,
          payment_method: "saldo",
          status: "success",
          transaction_id: `PAY-${Date.now()}`,
          description: `Pembayaran booking parkir #${booking._id}`,
        });

        // Create saldo debit record
        await Transaction.create({
          user_id: user._id,
          type: "saldo_debit",
          amount: totalCost,
          payment_method: "booking_payment",
          status: "success",
          transaction_id: `DEBIT-${Date.now()}`,
          description: `Pembayaran booking parkir menggunakan saldo`,
        });

        // Publish event untuk subscription
        pubsub.publish("BOOKING_STATUS_CHANGED", {
          bookingStatusChanged: booking,
        });

        console.log(`✅ Booking created: ${booking._id} for user ${user._id}`);

        // Return with additional data
        return {
          booking: booking,
          qr_code: null,
          total_cost: totalCost,
          message: "Booking berhasil dibuat",
        };
      } catch (error) {
        console.error("❌ Create booking error:", error);
        throw new Error(`Gagal membuat booking: ${error.message}`);
      }
    },

    // Cancel booking
    cancelBooking: async (_, { id }, { user }) => {
      ensureAuth(user);

      const booking = await Booking.findById(id);
      if (!booking) throw new Error("Booking tidak ditemukan");

      if (booking.user_id.toString() !== user._id.toString()) {
        throw new Error("Anda tidak memiliki akses");
      }

      const updatedBooking = await Booking.updateStatus(id, "cancelled");

      // Publish event untuk subscription
      await publish(EVENTS.BOOKING.UPDATED, {
        bookingUpdated: updatedBooking,
        userId: booking.user_id,
      });

      return updatedBooking;
    },

    // Confirm booking
    confirmBooking: async (_, { id }, { user }) => {
      ensureAuth(user);

      const booking = await Booking.findById(id);
      if (!booking) throw new Error("Booking tidak ditemukan");

      const updatedBooking = await Booking.updateStatus(id, "confirmed");

      // Publish event untuk subscription
      await publish(EVENTS.BOOKING.UPDATED, {
        bookingUpdated: updatedBooking,
        userId: booking.user_id,
      });

      return updatedBooking;
    },

    // Perpanjang durasi booking
    extendBooking: async (_, { id, additionalDuration }, { user }) => {
      ensureAuth(user);

      const booking = await Booking.findById(id);
      if (!booking) throw new Error("Booking tidak ditemukan");

      // Hitung biaya tambahan
      const parking = await Parking.findById(booking.parking_id);
      const additionalCost = parking.tariff * additionalDuration;

      const updatedBooking = await Booking.extend(
        id,
        additionalDuration,
        additionalCost
      );

      // Publish event untuk subscription
      await publish(EVENTS.BOOKING.UPDATED, {
        bookingUpdated: updatedBooking,
        userId: booking.user_id,
      });

      return updatedBooking;
    },

    // Generate QR Code untuk booking
    generateBookingQR: async (_, { bookingId }, { user }) => {
      ensureAuth(user);

      const booking = await Booking.findById(bookingId);
      if (!booking) throw new Error("Booking tidak ditemukan");

      // Pastikan user yang buat booking atau owner parking
      const parking = await Parking.findById(booking.parking_id);
      if (
        booking.user_id.toString() !== user._id.toString() &&
        parking.owner_id.toString() !== user._id.toString()
      ) {
        throw new Error("Anda tidak memiliki akses");
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
            message: "Booking tidak ditemukan",
          };
        }

        // Pastikan QR code masih valid berdasarkan status booking
        if (booking.status !== "confirmed") {
          return {
            isValid: false,
            booking,
            message: "Booking tidak valid atau sudah selesai",
          };
        }

        return {
          isValid: true,
          booking,
          message: "QR Code valid",
        };
      } catch (error) {
        return {
          isValid: false,
          booking: null,
          message: error.message,
        };
      }
    },

    // Generate QR Code untuk entry/exit parking
    generateParkingAccessQR: async (_, { bookingId, type }, { user }) => {
      ensureAuth(user);

      const booking = await Booking.findById(bookingId);
      if (!booking) throw new Error("Booking tidak ditemukan");

      // Pastikan user yang buat booking atau owner parking
      const parking = await Parking.findById(booking.parking_id);
      if (
        booking.user_id.toString() !== user._id.toString() &&
        parking.owner_id.toString() !== user._id.toString()
      ) {
        throw new Error("Anda tidak memiliki akses");
      }

      if (!["entry", "exit"].includes(type)) {
        throw new Error("Type harus entry atau exit");
      }

      return await Booking.generateAccessQR(bookingId, type);
    },

    // Generate Entry QR Code
    generateEntryQR: async (_, { bookingId }, { user }) => {
      ensureAuth(user);

      const booking = await Booking.findById(bookingId);
      if (!booking) throw new Error("Booking tidak ditemukan");

      // Hanya user yang membuat booking yang bisa generate entry QR
      if (booking.user_id.toString() !== user._id.toString()) {
        throw new Error("Anda tidak memiliki akses");
      }

      // Hanya booking dengan status confirmed yang bisa generate entry QR
      if (booking.status !== "confirmed") {
        throw new Error(
          "Hanya booking yang sudah confirmed yang bisa generate entry QR"
        );
      }

      try {
        const result = await Booking.generateEntryQR(bookingId);
        return result;
      } catch (error) {
        throw new Error(`Gagal generate entry QR: ${error.message}`);
      }
    },

    // Generate Exit QR Code
    generateExitQR: async (_, { bookingId }, { user }) => {
      ensureAuth(user);

      const booking = await Booking.findById(bookingId);
      if (!booking) throw new Error("Booking tidak ditemukan");

      // Hanya user yang membuat booking yang bisa generate exit QR
      if (booking.user_id.toString() !== user._id.toString()) {
        throw new Error("Anda tidak memiliki akses");
      }

      // Hanya booking dengan status active yang bisa generate exit QR
      if (booking.status !== "active") {
        throw new Error(
          "Hanya booking yang sedang aktif yang bisa generate exit QR"
        );
      }

      try {
        const result = await Booking.generateExitQR(bookingId);
        return result;
      } catch (error) {
        throw new Error(`Gagal generate exit QR: ${error.message}`);
      }
    },

    // Scan Entry QR Code
    scanEntryQR: async (_, { qrCode }, { user }) => {
      ensureAuth(user);

      try {
        const result = await Booking.scanEntryQR(qrCode, user._id);

        // Publish event untuk subscription
        pubsub.publish("BOOKING_STATUS_CHANGED", {
          bookingStatusChanged: result.booking,
        });

        return result;
      } catch (error) {
        throw new Error(`Gagal scan entry QR: ${error.message}`);
      }
    },

    // Scan Exit QR Code
    scanExitQR: async (_, { qrCode }, { user }) => {
      ensureAuth(user);

      try {
        const result = await Booking.scanExitQR(qrCode, user._id);

        // Publish event untuk subscription
        pubsub.publish("BOOKING_STATUS_CHANGED", {
          bookingStatusChanged: result.booking,
        });

        return result;
      } catch (error) {
        throw new Error(`Gagal scan exit QR: ${error.message}`);
      }
    },
  },

  Subscription: {
    // Subscription untuk status booking berubah
    bookingStatusChanged: {
      subscribe: (_, { parking_id }, { user }) => {
        ensureAuth(user);
        return subscribe(EVENTS.BOOKING.UPDATED);
      },
    },
  },

  Booking: {
    // Resolve user yang membuat booking
    user: async (booking) => {
      return await User.findById(booking.user_id);
    },

    // Resolve parking yang dibooking
    parking: async (booking) => {
      return await Parking.findById(booking.parking_id);
    },
  },
};
