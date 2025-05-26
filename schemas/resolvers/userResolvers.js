import { User } from "../../models/User.js";
import { GraphQLError } from "graphql";
import { generateToken } from "../../helpers/jwt.js";

export const userResolvers = {
  Query: {
    me: async (_, __, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      return await User.findById(user._id);
    },
    getUserById: async (_, { userId }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      return await User.findById(userId);
    }
  },

  Mutation: {
    register: async (_, { input }) => {
      const { email, password, name, role } = input;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        throw new GraphQLError("Email sudah terdaftar", {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }

      // Create new user
      const user = await User.create({
        email,
        password,
        name,
        role: role || "user"
      });

      // Generate token
      const token = generateToken(user);

      return {
        token,
        user
      };
    },

    login: async (_, { input }) => {
      const { email, password } = input;

      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        throw new GraphQLError("Email atau password salah", {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      // Check password
      const isValid = await User.comparePassword(user.password, password);
      if (!isValid) {
        throw new GraphQLError("Email atau password salah", {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      // Generate token
      const token = generateToken(user);

      return {
        token,
        user
      };
    },

    updateProfile: async (_, { name }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const updatedUser = await User.update(user._id, { name });
      return updatedUser;
    },

    changePassword: async (_, { oldPassword, newPassword }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const currentUser = await User.findById(user._id);
      
      // Verify old password
      const isValid = await User.comparePassword(currentUser.password, oldPassword);
      if (!isValid) {
        throw new GraphQLError("Password lama tidak sesuai", {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      // Update password
      await User.update(user._id, { password: newPassword });
      return true;
    }
  },

  User: {
    // Resolver untuk field User jika diperlukan
    // Misalnya untuk resolve relationship dengan model lain
  }
}; 