import { User } from "../../models/User.js";
import { GraphQLError } from "graphql";
import { generateToken } from "../../helpers/jwt.js";
import { verifyGoogleToken } from "../../helpers/googleAuth.js";

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
      
      // Return mock data for now - can be enhanced later with real statistics
      return {
        totalParkingLots: 5,
        parkingLotsChange: 2,
        monthlyEarnings: 1500000,
        earningsChange: 150000,
        activeBookings: 12,
        bookingsChange: 3,
        totalUsers: 150,
        usersChange: 25,
        platformRevenue: 750000,
        revenueChange: 75000,
        pendingApprovals: 3,
        totalBookings: 45,
        totalSpent: 300000,
        spentChange: 50000,
        walletChange: 25000
      };
    },
    getRecentActivity: async (_, { limit = 10 }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      
      // Return mock data for now - can be enhanced later with real activity data
      return [
        {
          id: "1",
          type: "user_registered",
          title: "Welcome to Parkirin!",
          description: "Your account has been successfully created",
          timestamp: new Date().toISOString(),
          location: null,
          bookingId: null,
          parkingId: null,
          chatId: null
        }
      ];
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
            isEmailVerified: true
          });
        } else {
          // Update user info if needed
          await User.update(user._id, {
            name,
            avatar,
            googleId: payload.sub,
            isEmailVerified: true
          });
        }

        // Generate token
        const authToken = generateToken(user);

        return {
          token: authToken,
          user
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

        throw new GraphQLError(error.message || "Gagal melakukan autentikasi Google", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
  },

  User: {
    // Resolver untuk field User jika diperlukan
    // Misalnya untuk resolve relationship dengan model lain
  },
};
