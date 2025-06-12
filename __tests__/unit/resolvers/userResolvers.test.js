import { User } from "../../../models/User.js";
import { userResolvers } from "../../../schemas/resolvers/userResolvers.js";
import { GraphQLError } from "graphql";
import { generateToken } from "../../../helpers/jwt.js";
import { verifyGoogleToken } from "../../../helpers/googleAuth.js";
import { getDB } from "../../../config/db.js";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";

// Mock dependencies
jest.mock("../../../models/User.js", () => ({
  User: {
    findById: jest.fn(),
    findOne: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    comparePassword: jest.fn()
  }
}));
jest.mock("../../../helpers/jwt.js");
jest.mock("../../../helpers/googleAuth.js");
jest.mock("../../../config/db.js");
jest.mock("bcryptjs");

describe("User Resolvers", () => {
  let mockContext;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = {
      user: {
        _id: new ObjectId(),
        email: "test@example.com",
        role: "user"
      }
    };
  });

  describe("Query", () => {
    describe("me", () => {
      it("should throw error if user is not authenticated", async () => {
        const mockContext = { user: null };
        
        await expect(userResolvers.Query.me(null, {}, mockContext))
          .rejects
          .toThrow("Anda harus login terlebih dahulu");
      });

      it("should return user data if authenticated", async () => {
        const mockUser = {
          _id: mockContext.user._id,
          email: "test@example.com",
          name: "Test User"
        };

        User.findById.mockResolvedValue(mockUser);

        const result = await userResolvers.Query.me(null, {}, mockContext);
        
        expect(result).toEqual(mockUser);
        expect(User.findById).toHaveBeenCalledWith(mockContext.user._id);
      });
    });

    describe("getUserById", () => {
      it("should throw error if user is not authenticated", async () => {
        const mockContext = { user: null };
        const args = { userId: new ObjectId() };
        
        await expect(userResolvers.Query.getUserById(null, args, mockContext))
          .rejects
          .toThrow("Anda harus login terlebih dahulu");
      });

      it("should return user data for valid userId", async () => {
        const targetUserId = new ObjectId();
        const mockTargetUser = {
          _id: targetUserId,
          email: "target@example.com",
          name: "Target User"
        };

        User.findById.mockResolvedValue(mockTargetUser);

        const result = await userResolvers.Query.getUserById(
          null,
          { userId: targetUserId },
          mockContext
        );
        
        expect(result).toEqual(mockTargetUser);
        expect(User.findById).toHaveBeenCalledWith(targetUserId);
      });
    });

    describe("getDashboardStats", () => {
      it("should throw error if user is not authenticated", async () => {
        const mockContext = { user: null };
        
        await expect(userResolvers.Query.getDashboardStats(null, {}, mockContext))
          .rejects
          .toThrow("Anda harus login terlebih dahulu");
      });

      it("should return user stats for regular user", async () => {
        const mockDB = {
          collection: jest.fn().mockReturnThis(),
          find: jest.fn().mockReturnThis(),
          toArray: jest.fn().mockResolvedValue([
            { status: "active", total_price: 100 },
            { status: "completed", total_price: 200 }
          ])
        };

        getDB.mockReturnValue(mockDB);

        const result = await userResolvers.Query.getDashboardStats(
          null,
          {},
          mockContext
        );

        expect(result).toHaveProperty("activeBookings");
        expect(result).toHaveProperty("totalBookings");
        expect(result).toHaveProperty("totalSpent");
        expect(mockDB.collection).toHaveBeenCalledWith("bookings");
      });

      it("should return admin stats for admin user", async () => {
        mockContext.user.role = "admin";
        
        const mockDB = {
          collection: jest.fn().mockReturnThis(),
          find: jest.fn().mockReturnThis(),
          countDocuments: jest.fn().mockResolvedValue(10),
          aggregate: jest.fn().mockReturnThis(),
          toArray: jest.fn().mockResolvedValue([{ _id: null, totalRevenue: 1000 }])
        };

        getDB.mockReturnValue(mockDB);

        const result = await userResolvers.Query.getDashboardStats(
          null,
          {},
          mockContext
        );

        expect(result).toHaveProperty("totalUsers");
        expect(result).toHaveProperty("totalParkingLots");
        expect(result).toHaveProperty("platformRevenue");
        expect(mockDB.collection).toHaveBeenCalledWith("users");
        expect(mockDB.collection).toHaveBeenCalledWith("parkings");
        expect(mockDB.collection).toHaveBeenCalledWith("bookings");
      });
    });
  });

  describe("Mutation", () => {
    describe("register", () => {
      const mockInput = {
        email: "new@example.com",
        password: "password123",
        name: "New User",
        role: "user"
      };

      it("should throw error if email is invalid", async () => {
        const invalidInput = { ...mockInput, email: "invalid-email" };
        
        await expect(userResolvers.Mutation.register(null, { input: invalidInput }))
          .rejects
          .toThrow("Invalid email format");
      });

      it("should throw error if email already exists", async () => {
        User.findByEmail.mockResolvedValue({ email: mockInput.email });
        
        await expect(userResolvers.Mutation.register(null, { input: mockInput }))
          .rejects
          .toThrow("Email already exists");
      });

      it("should create new user and return token", async () => {
        const token = "mockToken123";
        const createdUser = { 
          _id: new ObjectId(),
          ...mockInput
        };

        User.findByEmail.mockResolvedValue(null);
        User.create.mockResolvedValue(createdUser);
        generateToken.mockReturnValue(token);

        const result = await userResolvers.Mutation.register(null, { input: mockInput });

        expect(result).toEqual({
          token,
          user: createdUser
        });
        expect(User.create).toHaveBeenCalledWith({
          ...mockInput,
          role: mockInput.role || "user"
        });
      });
    });

    describe("login", () => {
      const mockCredentials = {
        email: "test@example.com",
        password: "password123"
      };

      it("should throw error if user not found", async () => {
        User.findByEmail.mockResolvedValue(null);

        await expect(userResolvers.Mutation.login(null, { input: mockCredentials }))
          .rejects
          .toThrow("Email atau password salah");
      });

      it("should throw error if password is incorrect", async () => {
        const mockUser = {
          ...mockCredentials,
          password: "hashedPassword123"
        };

        User.findByEmail.mockResolvedValue(mockUser);
        User.comparePassword.mockResolvedValue(false);

        await expect(userResolvers.Mutation.login(null, { input: mockCredentials }))
          .rejects
          .toThrow("Email atau password salah");
      });

      it("should return token and user data if credentials are valid", async () => {
        const mockUser = {
          _id: new ObjectId(),
          ...mockCredentials,
          password: "hashedPassword123"
        };
        const token = "mockToken123";

        User.findByEmail.mockResolvedValue(mockUser);
        User.comparePassword.mockResolvedValue(true);
        generateToken.mockReturnValue(token);

        const result = await userResolvers.Mutation.login(null, { input: mockCredentials });

        expect(result).toEqual({
          token,
          user: mockUser
        });
      });
    });

    describe("updateProfile", () => {
      const mockName = "Updated Name";

      it("should throw error if user is not authenticated", async () => {
        const mockContext = { user: null };

        await expect(userResolvers.Mutation.updateProfile(null, { name: mockName }, mockContext))
          .rejects
          .toThrow("Anda harus login terlebih dahulu");
      });

      it("should throw error if name is too short", async () => {
        await expect(userResolvers.Mutation.updateProfile(null, { name: "A" }, mockContext))
          .rejects
          .toThrow("Nama harus minimal 2 karakter");
      });

      it("should update user profile and return updated data", async () => {
        const updatedUser = {
          ...mockContext.user,
          name: mockName
        };

        User.update.mockResolvedValue(updatedUser);

        const result = await userResolvers.Mutation.updateProfile(
          null,
          { name: mockName },
          mockContext
        );

        expect(result).toEqual(updatedUser);
        expect(User.update).toHaveBeenCalledWith(
          mockContext.user._id,
          { name: mockName }
        );
      });
    });

    describe("googleAuth", () => {
      const mockGoogleToken = "google-token-123";

      it("should throw error if token verification fails", async () => {
        verifyGoogleToken.mockRejectedValue(new Error("Invalid token"));

        await expect(userResolvers.Mutation.googleAuth(null, { token: mockGoogleToken }))
          .rejects
          .toThrow("Invalid token");
      });

      it("should create new user if email not registered", async () => {
        const googleUser = {
          email: "google@example.com",
          name: "Google User",
          picture: "avatar.jpg",
          sub: "google123"
        };
        const token = "mockToken123";
        
        verifyGoogleToken.mockResolvedValue(googleUser);
        User.findByEmail.mockResolvedValue(null);
        User.create.mockResolvedValue({ 
          _id: new ObjectId(),
          email: googleUser.email,
          name: googleUser.name,
          avatar: googleUser.picture,
          googleId: googleUser.sub,
          role: "user",
          isEmailVerified: true
        });
        generateToken.mockReturnValue(token);

        const result = await userResolvers.Mutation.googleAuth(null, { token: mockGoogleToken });

        expect(result).toHaveProperty("token");
        expect(result).toHaveProperty("user");
        expect(result.user.email).toBe(googleUser.email);
        expect(User.create).toHaveBeenCalledWith({
          email: googleUser.email,
          name: googleUser.name,
          avatar: googleUser.picture,
          googleId: googleUser.sub,
          role: "user",
          isEmailVerified: true
        });
      });

      it("should update and login existing user if email already registered", async () => {
        const existingUser = {
          _id: new ObjectId(),
          email: "google@example.com",
          name: "Existing User"
        };
        const googleUser = {
          email: existingUser.email,
          name: "Updated Name",
          picture: "new-avatar.jpg",
          sub: "google123"
        };
        const token = "mockToken123";

        verifyGoogleToken.mockResolvedValue(googleUser);
        User.findByEmail.mockResolvedValue(existingUser);
        User.update.mockResolvedValue({
          ...existingUser,
          name: googleUser.name,
          avatar: googleUser.picture,
          googleId: googleUser.sub,
          isEmailVerified: true
        });
        generateToken.mockReturnValue(token);

        const result = await userResolvers.Mutation.googleAuth(null, { token: mockGoogleToken });

        expect(result).toHaveProperty("token");
        expect(result).toHaveProperty("user");
        expect(User.update).toHaveBeenCalledWith(existingUser._id, {
          name: googleUser.name,
          avatar: googleUser.picture,
          googleId: googleUser.sub,
          isEmailVerified: true
        });
        expect(result).toEqual({
          token,
          user: existingUser
        });
      });
    });
  });
}); 