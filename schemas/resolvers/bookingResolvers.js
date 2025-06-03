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
    getParkingBookings: async (_, args, { user }) => {
      ensureAuth(user);

      const {
        parkingId,
        status,
        startDate,
        endDate,
        limit = 50,
        offset = 0,
      } = args;

      try {
        console.log("🔍 getParkingBookings called with:", {
          parkingId,
          status,
          limit,
          offset,
        });

        // Verify that user owns the parking using Parking model
        const parking = await Parking.findById(parkingId);
        if (!parking) {
          throw new GraphQLError("Parking tidak ditemukan", {
            extensions: { code: "PARKING_NOT_FOUND" },
          });
        }

        if (parking.owner_id.toString() !== user._id.toString()) {
          throw new GraphQLError("Anda tidak memiliki akses ke parking ini", {
            extensions: { code: "UNAUTHORIZED_PARKING_ACCESS" },
          });
        }

        console.log("✅ Parking ownership verified");

        // ✅ USE MODEL METHOD instead of direct MongoDB operations
        const result = await Booking.getParkingBookings({
          parkingId,
          status,
          startDate,
          endDate,
          limit,
          offset,
        });

        console.log("✅ Booking data retrieved:", {
          totalBookings: result.total,
          returnedCount: result.bookings.length,
        });

        // Format response for GraphQL
        return {
          bookings: result.bookings.map((booking) => ({
            ...booking,
            _id: booking._id.toString(),
            user_id: booking.user_id.toString(),
            parking_id: booking.parking_id.toString(),
            // Add parking data from the verified parking
            parking: {
              _id: parking._id.toString(),
              name: parking.name,
              address: parking.address,
              location: parking.location,
              owner_id: parking.owner_id.toString(),
              rates: parking.rates,
              capacity: parking.capacity,
              available: parking.available,
              status: parking.status,
              // Add other parking fields as needed
            },
          })),
          total: result.total,
          hasMore: result.hasMore,
          stats: result.stats,
        };
      } catch (error) {
        console.error("❌ Get parking bookings error:", error);
        throw new GraphQLError(
          `Gagal mengambil data booking: ${error.message}`,
          {
            extensions: {
              code: "GET_PARKING_BOOKINGS_FAILED",
              parkingId,
              userId: user._id,
            },
          }
        );
      }
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

        // ✅ FIXED: Create booking with PENDING status, NO payment yet
        const booking = await Booking.create({
          user_id: user._id,
          parking_id,
          vehicle_type: normalizedVehicleType,
          start_time: startDateTime.toISOString(),
          duration,
          cost: totalCost, // Store cost for later payment
          status: "pending", // Pending until payment
        });

        console.log(
          `✅ Booking created: ${booking._id} for user ${user._id} with PENDING status`
        );

        return {
          booking: booking,
          qr_code: null,
          total_cost: totalCost,
          message:
            "Booking berhasil dibuat. Silakan lakukan pembayaran untuk konfirmasi.",
        };
      } catch (error) {
        console.error("❌ Create booking error:", error);
        throw new Error(`Gagal membuat booking: ${error.message}`);
      }
    },

    // Confirm booking
    confirmBooking: async (_, { id }, { user }) => {
      ensureAuth(user);

      const booking = await Booking.findById(id);
      if (!booking) throw new Error("Booking tidak ditemukan");

      if (booking.user_id.toString() !== user._id.toString()) {
        throw new Error("Anda tidak memiliki akses");
      }

      // ✅ Only allow payment for pending bookings
      if (booking.status !== "pending") {
        throw new Error(
          `Booking dengan status "${booking.status}" tidak dapat dibayar`
        );
      }

      // ✅ Check user balance BEFORE payment
      const currentUser = await User.findById(user._id);
      if (currentUser.saldo < booking.cost) {
        throw new Error(
          `Saldo tidak mencukupi. Dibutuhkan Rp ${booking.cost.toLocaleString()}, saldo Anda Rp ${currentUser.saldo.toLocaleString()}`
        );
      }

      try {
        // ✅ NOW deduct saldo when confirming payment
        await User.updateSaldo(user._id, -booking.cost);

        // ✅ Create payment transaction
        await Transaction.create({
          user_id: user._id,
          booking_id: booking._id,
          type: "payment",
          amount: booking.cost,
          payment_method: "saldo",
          status: "success",
          transaction_id: `PAY-${Date.now()}`,
          description: `Pembayaran booking parkir #${booking._id}`,
        });

        // ✅ Create saldo debit record
        await Transaction.create({
          user_id: user._id,
          type: "saldo_debit",
          amount: booking.cost,
          payment_method: "booking_payment",
          status: "success",
          transaction_id: `DEBIT-${Date.now()}`,
          description: `Pembayaran booking parkir menggunakan saldo`,
        });

        // ✅ Update booking status to confirmed
        const updatedBooking = await Booking.updateStatus(id, "confirmed");

        console.log(`✅ Booking ${id} confirmed and paid`);

        return {
          ...updatedBooking,
          user: await User.findById(user._id), // Return updated user with new saldo
        };
      } catch (error) {
        console.error("❌ Confirm booking error:", error);
        throw new Error(`Gagal konfirmasi booking: ${error.message}`);
      }
    },

    // Cancel booking with proper validation and refund
    cancelBooking: async (_, { id }, { user }) => {
      try {
        ensureAuth(user);

        console.log(`🔍 Cancel booking request - ID: ${id}, User: ${user._id}`);

        // ✅ Basic validation
        if (!ObjectId.isValid(id)) {
          throw new Error("Format ID booking tidak valid");
        }

        // ✅ Find and validate booking
        const booking = await Booking.findById(id);
        if (!booking) {
          throw new Error("Booking tidak ditemukan");
        }

        // ✅ Check ownership
        if (booking.user_id.toString() !== user._id.toString()) {
          throw new Error("Anda tidak memiliki akses ke booking ini");
        }

        // ✅ Check status
        if (booking.status !== "pending") {
          throw new Error(
            `Tidak dapat membatalkan booking dengan status "${booking.status}". Hanya booking dengan status "pending" yang dapat dibatalkan.`
          );
        }

        console.log(`✅ Validation passed - proceeding with cancellation`);

        // ✅ Cancel the booking using updateStatus method instead
        const updatedBooking = await Booking.updateStatus(id, "cancelled");

        if (!updatedBooking) {
          throw new Error("Gagal mengupdate status booking");
        }

        // ✅ Get current user data
        const currentUser = await User.findById(user._id);

        // ✅ Create cancellation transaction record
        try {
          await Transaction.create({
            user_id: user._id,
            booking_id: booking._id,
            type: "cancellation",
            amount: 0,
            payment_method: "booking_cancel",
            status: "success",
            transaction_id: `CANCEL-${Date.now()}`,
            description: `Pembatalan booking parkir #${booking._id} (status pending)`,
          });
          console.log(`✅ Cancellation transaction recorded`);
        } catch (transactionError) {
          console.log(
            `⚠️ Failed to create transaction record:`,
            transactionError
          );
        }

        console.log(`✅ Booking ${id} cancelled successfully`);

        // ✅ Return proper CancelBookingResponse structure
        return {
          _id: updatedBooking._id.toString(),
          status: "cancelled",
          refund_amount: 0,
          message:
            "Booking berhasil dibatalkan. Tidak ada biaya yang dikenakan karena pembayaran belum dilakukan.",
          user: currentUser || { _id: user._id, saldo: 0 },
          booking: {
            _id: updatedBooking._id,
            user_id: updatedBooking.user_id,
            parking_id: updatedBooking.parking_id,
            vehicle_type: updatedBooking.vehicle_type,
            start_time: updatedBooking.start_time,
            duration: updatedBooking.duration,
            cost: updatedBooking.cost,
            status: "cancelled",
            created_at: updatedBooking.created_at,
            updated_at: updatedBooking.updated_at || new Date(),
            qr_code: updatedBooking.qr_code || null,
            entry_qr: updatedBooking.entry_qr || null,
            exit_qr: updatedBooking.exit_qr || null,
          },
        };
      } catch (error) {
        console.error("❌ Cancel booking error:", error);
        throw new GraphQLError(`Gagal membatalkan booking: ${error.message}`, {
          extensions: {
            code: "BOOKING_CANCELLATION_FAILED",
            bookingId: id,
            userId: user?._id,
          },
        });
      }
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

    // ✅ FIXED: Single scanEntryQR resolver with ScanQRResponse format
    scanEntryQR: async (_, { qrCode }, { user }) => {
      ensureAuth(user);

      try {
        console.log(`🔍 Scanning entry QR: ${qrCode} by user: ${user._id}`);

        // ✅ DECODE QR to get booking info first
        const { verifyQRToken } = await import("../../helpers/qrcode.js");
        const decoded = verifyQRToken(qrCode);

        console.log("🔍 Decoded QR:", decoded);

        // ✅ GET booking to check authorization
        const booking = await Booking.findById(decoded.bookingId);
        if (!booking) {
          return {
            success: false,
            message: "Booking tidak ditemukan",
            booking: null,
            overtimeCost: 0,
          };
        }

        // ✅ CHECK if user is either booking owner OR parking owner
        const parking = await Parking.findById(booking.parking_id);
        const isBookingOwner =
          booking.user_id.toString() === user._id.toString();
        const isParkingOwner =
          parking && parking.owner_id.toString() === user._id.toString();

        if (!isBookingOwner && !isParkingOwner) {
          return {
            success: false,
            message: "Anda tidak memiliki akses untuk scan QR code ini",
            booking: null,
            overtimeCost: 0,
          };
        }

        console.log(
          `✅ Authorization passed - User type: ${
            isParkingOwner ? "Land Owner" : "Customer"
          }`
        );

        // ✅ DIRECT database update instead of model method
        const { getDB } = await import("../../config/db.js");
        const db = getDB();

        // Check booking status
        if (booking.status !== "confirmed") {
          return {
            success: false,
            message: `Booking dengan status "${booking.status}" tidak dapat di-scan untuk entry`,
            booking: null,
            overtimeCost: 0,
          };
        }

        // Update booking status to active
        const result = await db.collection("bookings").updateOne(
          { _id: booking._id },
          {
            $set: {
              status: "active",
              actual_entry_time: new Date(),
              updated_at: new Date(),
            },
          }
        );

        if (result.modifiedCount === 0) {
          return {
            success: false,
            message: "Gagal mengupdate status booking",
            booking: null,
            overtimeCost: 0,
          };
        }

        // Get updated booking
        const updatedBooking = await Booking.findById(booking._id);

        console.log(
          `✅ Entry scan successful - Booking ${booking._id} now active`
        );

        // Publish event untuk subscription
        pubsub.publish("BOOKING_STATUS_CHANGED", {
          bookingStatusChanged: updatedBooking,
        });

        return {
          success: true,
          message: "Entry berhasil! Booking sekarang aktif.",
          booking: updatedBooking,
          overtimeCost: 0,
        };
      } catch (error) {
        console.error("❌ Scan entry QR error:", error);

        return {
          success: false,
          message: error.message || "Failed to scan entry QR code",
          booking: null,
          overtimeCost: 0,
        };
      }
    },

    // ✅ FIXED: Enhanced scanExitQR with land owner support
    scanExitQR: async (_, { qrCode }, { user }) => {
      ensureAuth(user);

      try {
        console.log(`🔍 Scanning exit QR: ${qrCode} by user: ${user._id}`);

        // ✅ DECODE QR to get booking info first
        const { verifyQRToken } = await import("../../helpers/qrcode.js");
        const decoded = verifyQRToken(qrCode);

        console.log("🔍 Decoded QR:", decoded);

        // ✅ GET booking to check authorization
        const booking = await Booking.findById(decoded.bookingId);
        if (!booking) {
          return {
            success: false,
            message: "Booking tidak ditemukan",
            booking: null,
            overtimeCost: 0,
          };
        }

        // ✅ CHECK if user is either booking owner OR parking owner
        const parking = await Parking.findById(booking.parking_id);
        const isBookingOwner =
          booking.user_id.toString() === user._id.toString();
        const isParkingOwner =
          parking && parking.owner_id.toString() === user._id.toString();

        if (!isBookingOwner && !isParkingOwner) {
          return {
            success: false,
            message: "Anda tidak memiliki akses untuk scan QR code ini",
            booking: null,
            overtimeCost: 0,
          };
        }

        console.log(
          `✅ Authorization passed - User type: ${
            isParkingOwner ? "Land Owner" : "Customer"
          }`
        );

        // ✅ DIRECT database update instead of model method
        const { getDB } = await import("../../config/db.js");
        const db = getDB();

        // Check booking status
        if (booking.status !== "active") {
          return {
            success: false,
            message: `Booking dengan status "${booking.status}" tidak dapat di-scan untuk exit`,
            booking: null,
            overtimeCost: 0,
          };
        }

        // Calculate overtime if any
        const now = new Date();
        const startTime = new Date(booking.start_time);
        const plannedEndTime = new Date(
          startTime.getTime() + booking.duration * 60 * 60 * 1000
        );
        let overtimeCost = 0;

        if (now > plannedEndTime) {
          const overtimeHours = Math.ceil(
            (now - plannedEndTime) / (60 * 60 * 1000)
          );
          const hourlyRate = parking?.rates?.[booking.vehicle_type] || 0;
          overtimeCost = overtimeHours * hourlyRate;
        }

        // Update booking status to completed
        const result = await db.collection("bookings").updateOne(
          { _id: booking._id },
          {
            $set: {
              status: "completed",
              actual_exit_time: now,
              overtime_cost: overtimeCost,
              updated_at: now,
            },
          }
        );

        if (result.modifiedCount === 0) {
          return {
            success: false,
            message: "Gagal mengupdate status booking",
            booking: null,
            overtimeCost: 0,
          };
        }

        // Get updated booking
        const updatedBooking = await Booking.findById(booking._id);

        console.log(
          `✅ Exit scan successful - Booking ${booking._id} completed`
        );

        // Publish event untuk subscription
        pubsub.publish("BOOKING_STATUS_CHANGED", {
          bookingStatusChanged: updatedBooking,
        });

        return {
          success: true,
          message:
            overtimeCost > 0
              ? `Exit berhasil! Booking selesai dengan overtime Rp ${overtimeCost.toLocaleString()}`
              : "Exit berhasil! Booking selesai tepat waktu.",
          booking: updatedBooking,
          overtimeCost,
        };
      } catch (error) {
        console.error("❌ Scan exit QR error:", error);

        return {
          success: false,
          message: error.message || "Failed to scan exit QR code",
          booking: null,
          overtimeCost: 0,
        };
      }
    },

    // ✅ REMOVED: Delete duplicate scanEntryQR and scanExitQR resolvers
  }, // ✅ End Mutation here

  // ✅ Move Subscription out of Mutation
  Subscription: {
    // Subscription untuk status booking berubah
    bookingStatusChanged: {
      subscribe: (_, { parking_id }, { user }) => {
        ensureAuth(user);
        return subscribe(EVENTS.BOOKING.UPDATED);
      },
    },
  },

  // ✅ Keep Booking resolver at the same level
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
