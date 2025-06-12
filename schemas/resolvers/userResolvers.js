import { User } from "../../models/User.js";
import { Parking } from "../../models/Parking.js";
import { Booking } from "../../models/Booking.js";
import { GraphQLError } from "graphql";
import { generateToken } from "../../helpers/jwt.js";
import { verifyGoogleToken } from "../../helpers/googleAuth.js";
import { getDB } from "../../config/db.js";

function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export const userResolvers = {
  Query: {
    me: async (_, __, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      return await User.findById(user._id);
    },
    getUserById: async (_, { userId }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      return await User.findById(userId);
    },
    getDashboardStats: async (_, __, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const db = getDB();

      try {
        // Base stats object
        let stats = {
          totalParkingLots: 0,
          parkingLotsChange: 0,
          monthlyEarnings: 0,
          earningsChange: 0,
          activeBookings: 0,
          bookingsChange: 0,
          totalUsers: 0,
          usersChange: 0,
          platformRevenue: 0,
          revenueChange: 0,
          pendingApprovals: 0,
          totalBookings: 0,
          totalSpent: 0,
          spentChange: 0,
          walletChange: 0,
        };

        // Role-based statistics
        switch (user.role) {
          case "admin":
            // Admin sees platform-wide statistics
            const totalUsers = await db.collection("users").countDocuments();
            const totalParkingLots = await db
              .collection("parkings")
              .countDocuments({ is_deleted: { $ne: true } });
            const totalBookings = await db
              .collection("bookings")
              .countDocuments();
            const activeBookings = await db
              .collection("bookings")
              .countDocuments({
                status: { $in: ["pending", "confirmed", "active"] },
              });
            const pendingApprovals = await db
              .collection("parkings")
              .countDocuments({
                status: "pending",
              });

            // Calculate platform revenue (total from completed bookings)
            const revenueAggregation = await db
              .collection("bookings")
              .aggregate([
                { $match: { status: { $in: ["completed", "paid"] } } },
                {
                  $group: { _id: null, totalRevenue: { $sum: "$total_price" } },
                },
              ])
              .toArray();
            const platformRevenue = revenueAggregation[0]?.totalRevenue || 0;

            stats = {
              ...stats,
              totalUsers,
              totalParkingLots,
              totalBookings,
              activeBookings,
              pendingApprovals,
              platformRevenue,
              usersChange: Math.floor(totalUsers * 0.1), // 10% growth placeholder
              parkingLotsChange: Math.floor(totalParkingLots * 0.05), // 5% growth placeholder
              revenueChange: Math.floor(platformRevenue * 0.15), // 15% growth placeholder
            };
            break;

          case "landowner":
            // Landowner sees their own parking statistics
            const ownerStats = await Parking.getOwnerStats(user._id);
            const userParkings = await db
              .collection("parkings")
              .find({
                owner_id: user._id,
                is_deleted: { $ne: true },
              })
              .toArray();

            const userParkingIds = userParkings.map((p) => p._id);
            const ownerActiveBookings = await db
              .collection("bookings")
              .countDocuments({
                parking_id: { $in: userParkingIds },
                status: { $in: ["pending", "confirmed", "active"] },
              });

            const ownerTotalBookings = await db
              .collection("bookings")
              .countDocuments({
                parking_id: { $in: userParkingIds },
              });

            stats = {
              ...stats,
              totalParkingLots: userParkings.length,
              monthlyEarnings: ownerStats.totalIncome,
              activeBookings: ownerActiveBookings,
              totalBookings: ownerTotalBookings,
              walletChange: ownerStats.currentBalance,
              parkingLotsChange: Math.max(0, userParkings.length - 1), // At least 0
              earningsChange: Math.floor(ownerStats.totalIncome * 0.2), // 20% growth placeholder
              bookingsChange: Math.floor(ownerActiveBookings * 0.1), // 10% growth placeholder
            };
            break;

          case "user":
          default:
            // Regular user sees their own booking statistics
            const userBookings = await db
              .collection("bookings")
              .find({
                user_id: user._id,
              })
              .toArray();

            const userActiveBookings = userBookings.filter((b) =>
              ["pending", "confirmed", "active"].includes(b.status)
            ).length;

            const userTotalSpent = userBookings
              .filter((b) => ["completed", "paid"].includes(b.status))
              .reduce((sum, booking) => sum + (booking.total_price || 0), 0);

            stats = {
              ...stats,
              activeBookings: userActiveBookings,
              totalBookings: userBookings.length,
              totalSpent: userTotalSpent,
              walletChange: user.saldo || 0,
              bookingsChange: Math.floor(userActiveBookings * 0.1), // 10% growth placeholder
              spentChange: Math.floor(userTotalSpent * 0.15), // 15% growth placeholder
            };
            break;
        }

        return stats;
      } catch (error) {
        console.error("Error getting dashboard stats:", error);
        // Fallback to basic stats if there's an error
        return {
          totalParkingLots: 0,
          parkingLotsChange: 0,
          monthlyEarnings: 0,
          earningsChange: 0,
          activeBookings: 0,
          bookingsChange: 0,
          totalUsers: 0,
          usersChange: 0,
          platformRevenue: 0,
          revenueChange: 0,
          pendingApprovals: 0,
          totalBookings: 0,
          totalSpent: 0,
          spentChange: 0,
          walletChange: 0,
        };
      }
    },
    getRecentActivity: async (_, { limit = 10 }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const db = getDB();

      try {
        let activities = [];

        switch (user.role) {
          case "admin":
            // Admin sees platform-wide activities
            const recentBookings = await db
              .collection("bookings")
              .find({})
              .sort({ created_at: -1 })
              .limit(limit)
              .toArray();

            // Get user and parking info for bookings
            const userIds = [...new Set(recentBookings.map((b) => b.user_id))];
            const parkingIds = [
              ...new Set(recentBookings.map((b) => b.parking_id)),
            ];

            const users = await db
              .collection("users")
              .find({ _id: { $in: userIds } })
              .toArray();
            const parkings = await db
              .collection("parkings")
              .find({ _id: { $in: parkingIds } })
              .toArray();

            const userMap = Object.fromEntries(
              users.map((u) => [u._id.toString(), u])
            );
            const parkingMap = Object.fromEntries(
              parkings.map((p) => [p._id.toString(), p])
            );

            activities = recentBookings.map((booking) => {
              const bookingUser = userMap[booking.user_id.toString()];
              const parking = parkingMap[booking.parking_id.toString()];

              return {
                id: booking._id.toString(),
                type: "booking_created",
                title: `New booking by ${bookingUser?.name || "Unknown User"}`,
                description: `Booking at ${
                  parking?.name || "Unknown Parking"
                } - Status: ${booking.status}`,
                timestamp: booking.created_at.toISOString(),
                location: parking?.address || null,
                bookingId: booking._id.toString(),
                parkingId: booking.parking_id.toString(),
                chatId: null,
              };
            });
            break;

          case "landowner":
            // Landowner sees activities related to their parkings
            const ownerParkings = await db
              .collection("parkings")
              .find({ owner_id: user._id, is_deleted: { $ne: true } })
              .toArray();

            const ownerParkingIds = ownerParkings.map((p) => p._id);

            const ownerBookings = await db
              .collection("bookings")
              .find({ parking_id: { $in: ownerParkingIds } })
              .sort({ created_at: -1 })
              .limit(limit)
              .toArray();

            // Get user info for bookings
            const bookingUserIds = [
              ...new Set(ownerBookings.map((b) => b.user_id)),
            ];
            const bookingUsers = await db
              .collection("users")
              .find({ _id: { $in: bookingUserIds } })
              .toArray();

            const bookingUserMap = Object.fromEntries(
              bookingUsers.map((u) => [u._id.toString(), u])
            );
            const ownerParkingMap = Object.fromEntries(
              ownerParkings.map((p) => [p._id.toString(), p])
            );

            activities = ownerBookings.map((booking) => {
              const bookingUser = bookingUserMap[booking.user_id.toString()];
              const parking = ownerParkingMap[booking.parking_id.toString()];

              let activityType = "booking_created";
              let title = `New booking received`;

              switch (booking.status) {
                case "confirmed":
                  activityType = "booking_confirmed";
                  title = "Booking confirmed";
                  break;
                case "active":
                  activityType = "booking_active";
                  title = "Customer checked in";
                  break;
                case "completed":
                  activityType = "booking_completed";
                  title = "Booking completed";
                  break;
                case "cancelled":
                  activityType = "booking_cancelled";
                  title = "Booking cancelled";
                  break;
              }

              return {
                id: booking._id.toString(),
                type: activityType,
                title: title,
                description: `${bookingUser?.name || "Customer"} at ${
                  parking?.name || "your parking"
                } - Rp ${(booking.total_price || 0).toLocaleString()}`,
                timestamp: booking.created_at.toISOString(),
                location: parking?.address || null,
                bookingId: booking._id.toString(),
                parkingId: booking.parking_id.toString(),
                chatId: null,
              };
            });
            break;

          case "user":
          default:
            // Regular user sees their own activities
            const userBookings = await db
              .collection("bookings")
              .find({ user_id: user._id })
              .sort({ created_at: -1 })
              .limit(limit)
              .toArray();

            // Get parking info for user bookings
            const userParkingIds = [
              ...new Set(userBookings.map((b) => b.parking_id)),
            ];
            const userParkings = await db
              .collection("parkings")
              .find({ _id: { $in: userParkingIds } })
              .toArray();

            const userParkingMap = Object.fromEntries(
              userParkings.map((p) => [p._id.toString(), p])
            );

            activities = userBookings.map((booking) => {
              const parking = userParkingMap[booking.parking_id.toString()];

              let activityType = "booking_created";
              let title = "Booking created";

              switch (booking.status) {
                case "confirmed":
                  activityType = "booking_confirmed";
                  title = "Booking confirmed";
                  break;
                case "active":
                  activityType = "booking_active";
                  title = "Checked in successfully";
                  break;
                case "completed":
                  activityType = "booking_completed";
                  title = "Parking completed";
                  break;
                case "cancelled":
                  activityType = "booking_cancelled";
                  title = "Booking cancelled";
                  break;
              }

              return {
                id: booking._id.toString(),
                type: activityType,
                title: title,
                description: `${parking?.name || "Parking"} - ${
                  booking.duration
                }h - Rp ${(booking.total_price || 0).toLocaleString()}`,
                timestamp: booking.created_at.toISOString(),
                location: parking?.address || null,
                bookingId: booking._id.toString(),
                parkingId: booking.parking_id.toString(),
                chatId: null,
              };
            });
            break;
        }

        // If no activities found, add a welcome message
        if (activities.length === 0) {
          activities.push({
            id: "welcome",
            type: "user_registered",
            title: "Welcome to Parkirin!",
            description:
              "Your account has been successfully created. Start exploring parking options near you.",
            timestamp: user.created_at
              ? user.created_at.toISOString()
              : new Date().toISOString(),
            location: null,
            bookingId: null,
            parkingId: null,
            chatId: null,
          });
        }

        return activities;
      } catch (error) {
        console.error("Error getting recent activity:", error);
        // Fallback to welcome message if there's an error
        return [
          {
            id: "welcome",
            type: "user_registered",
            title: "Welcome to Parkirin!",
            description: "Your account has been successfully created",
            timestamp: new Date().toISOString(),
            location: null,
            bookingId: null,
            parkingId: null,
            chatId: null,
          },
        ];
      }
    },

    getUsersByRole: async (_, { role }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const allowedRoles = ["user", "landowner"];
      if (!allowedRoles.includes(role)) {
        throw new GraphQLError("Invalid role specified", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      return await User.find({ role });
    },
  },

  Mutation: {
    register: async (_, { input }) => {
      const { email, password, name, role } = input;

      if (!name) throw new Error("Name is required");

      if (!email) throw new Error("Email is required");

      if (!validateEmail(email)) throw new Error("Invalid email format");

      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        throw new GraphQLError("Email already exists", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      if (!password) throw new Error("Password is required");

      if (password.length < 6)
        throw new Error("Password must be at least 6 characters");

      if (!email) throw new Error("Email is required");

      const allowedRoles = ["user", "landowner"];
      if (!allowedRoles.includes(role)) {
        throw new Error("Invalid role. Must be either 'user' or 'landowner'");
      }

      // Create new user
      const user = await User.create({
        email,
        password,
        name,
        role: role || "user",
      });

      // Generate token
      const token = generateToken(user);

      return {
        token,
        user,
      };
    },

    login: async (_, { input }) => {
      const { email, password } = input;

      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        throw new GraphQLError("Email atau password salah", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Check password
      const isValid = await User.comparePassword(user.password, password);
      if (!isValid) {
        throw new GraphQLError("Email atau password salah", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Generate token
      const token = generateToken(user);

      return {
        token,
        user,
      };
    },
    updateProfile: async (_, { name }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      // Add validation for name
      if (!name || name.trim().length < 2) {
        throw new GraphQLError("Nama harus minimal 2 karakter", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const updatedUser = await User.update(user._id, { name });
      if (!updatedUser) {
        throw new GraphQLError("Gagal memperbarui profil", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
      return updatedUser;
    },

    changePassword: async (_, { oldPassword, newPassword }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const currentUser = await User.findById(user._id);

      // Verify old password
      const isValid = await User.comparePassword(
        currentUser.password,
        oldPassword
      );
      if (!isValid) {
        throw new GraphQLError("Password lama tidak sesuai", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Update password
      await User.update(user._id, { password: newPassword });
      return true;
    },

    googleAuth: async (_, { token }) => {
      try {
        if (!token) {
          throw new GraphQLError("Token Google diperlukan", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        // Verify Google token
        const payload = await verifyGoogleToken(token);

        const { email, name, picture: avatar } = payload;
        if (!email) {
          throw new GraphQLError("Email tidak ditemukan dalam token Google", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        // Find or create user
        let user = await User.findByEmail(email);
        if (!user) {
          user = await User.create({
            email,
            name,
            avatar,
            googleId: payload.sub,
            role: "user",
            isEmailVerified: true,
          });
        } else {
          // Update user info if needed
          await User.update(user._id, {
            name,
            avatar,
            googleId: payload.sub,
            isEmailVerified: true,
          });
        }

        // Generate token
        const authToken = generateToken(user);

        return {
          token: authToken,
          user,
        };
      } catch (error) {
        console.error("Google Auth Error:", error);

        // Handle specific error cases
        if (error.message.includes("GOOGLE_CLIENT_ID")) {
          throw new GraphQLError("Konfigurasi Google Auth tidak valid", {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          });
        }

        if (error.message.includes("Token is required")) {
          throw new GraphQLError("Token Google diperlukan", {
            extensions: { code: "BAD_USER_INPUT" },
          });
        }

        throw new GraphQLError(
          error.message || "Gagal melakukan autentikasi Google",
          {
            extensions: { code: "INTERNAL_SERVER_ERROR" },
          }
        );
      }
    },
  },

  User: {
    // Resolver untuk field User jika diperlukan
    // Misalnya untuk resolve relationship dengan model lain
  },
};
