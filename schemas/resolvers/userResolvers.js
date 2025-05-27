import { User } from "../../models/User.js";
import { GraphQLError } from "graphql";
import { generateToken } from "../../helpers/jwt.js";

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
  },

  User: {
    // Resolver untuk field User jika diperlukan
    // Misalnya untuk resolve relationship dengan model lain
  },
};
