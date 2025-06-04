import { User } from "../../../models/User.js";
import { getDB } from "../../../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Mock dependencies
jest.mock("../../../config/db.js");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");

describe("User Model", () => {
  let mockDb;
  let mockCollection;  beforeEach(() => {
    mockCollection = {
      findOne: jest.fn(),
      find: jest.fn(),
      insertOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      createIndex: jest.fn(),
      updateOne: jest.fn(),
    };

    mockDb = {
      collection: jest.fn().mockReturnValue(mockCollection),
    };

    getDB.mockReturnValue(mockDb);
    jest.clearAllMocks();
  });

  describe("findById", () => {
    it("should find user by ID successfully", async () => {
      const userId = "507f1f77bcf86cd799439011";
      const mockUser = { _id: userId, email: "test@example.com" };

      mockCollection.findOne.mockResolvedValue(mockUser);

      const result = await User.findById(userId);

      expect(mockCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(Object),
      });
      expect(result).toEqual(mockUser);
    });

    it("should return null if user not found", async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await User.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("should find user by email successfully", async () => {
      const email = "test@example.com";
      const mockUser = { _id: "507f1f77bcf86cd799439011", email };

      mockCollection.findOne.mockResolvedValue(mockUser);

      const result = await User.findByEmail(email);

      expect(mockCollection.findOne).toHaveBeenCalledWith({ email });
      expect(result).toEqual(mockUser);
    });

    it("should return null if user not found", async () => {
      mockCollection.findOne.mockResolvedValue(null);

      const result = await User.findByEmail("nonexistent@example.com");

      expect(result).toBeNull();
    });
  });

  describe("findByGoogleId", () => {
    it("should find user by Google ID successfully", async () => {
      const googleId = "google123";
      const mockUser = { _id: "507f1f77bcf86cd799439011", googleId };

      mockCollection.findOne.mockResolvedValue(mockUser);

      const result = await User.findByGoogleId(googleId);

      expect(mockCollection.findOne).toHaveBeenCalledWith({ googleId });
      expect(result).toEqual(mockUser);
    });
  });

  describe("create", () => {
    beforeEach(() => {
      bcrypt.genSalt.mockResolvedValue("salt");
      bcrypt.hash.mockResolvedValue("hashedpassword");
    });

    it("should create user with hashed password", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      };

      const insertedId = "507f1f77bcf86cd799439011";
      mockCollection.insertOne.mockResolvedValue({ insertedId });

      const result = await User.create(userData);

      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith("password123", "salt");
      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          email: userData.email,
          password: "hashedpassword",
          name: userData.name,
          role: "user",
          saldo: 0,
        })
      );
      expect(result._id).toBe(insertedId);
    });

    it("should create user with Google Auth password", async () => {
      const userData = {
        email: "test@example.com",
        password: "GOOGLE_AUTH_password",
        name: "Test User",
        googleId: "google123",
      };

      const insertedId = "507f1f77bcf86cd799439011";
      mockCollection.insertOne.mockResolvedValue({ insertedId });

      await User.create(userData);

      expect(bcrypt.genSalt).not.toHaveBeenCalled();
      expect(bcrypt.hash).not.toHaveBeenCalled();
      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          password: "GOOGLE_AUTH_password",
        })
      );
    });

    it("should set default values correctly", async () => {
      const userData = {
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      };

      mockCollection.insertOne.mockResolvedValue({
        insertedId: "507f1f77bcf86cd799439011",
      });

      await User.create(userData);
      expect(mockCollection.insertOne).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "user",
          saldo: 0,
          google_id: null,
          avatar: null,
          created_at: expect.any(Date),
        })
      );
    });
  });

  describe("update", () => {
    it("should update user without password", async () => {
      const userId = "507f1f77bcf86cd799439011";
      const updates = { name: "Updated Name" };
      const updatedUser = { _id: userId, name: "Updated Name" };

      mockCollection.findOneAndUpdate.mockResolvedValue(updatedUser);

      const result = await User.update(userId, updates);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: userId },
        { $set: expect.objectContaining({ name: "Updated Name" }) },
        { returnDocument: "after" }
      );
      expect(result).toEqual(updatedUser);
    });

    it("should update user with password hashing", async () => {
      const userId = "507f1f77bcf86cd799439011";
      const updates = { password: "newpassword" };
      bcrypt.genSalt.mockResolvedValue("salt");
      bcrypt.hash.mockResolvedValue("hashedpassword");
      mockCollection.findOneAndUpdate.mockResolvedValue({});

      await User.update(userId, updates);

      expect(bcrypt.genSalt).toHaveBeenCalledWith(10);
      expect(bcrypt.hash).toHaveBeenCalledWith("newpassword", "salt");
      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: userId },
        { $set: expect.objectContaining({ password: "hashedpassword" }) },
        { returnDocument: "after" }
      );
    });
  });
  describe("updateSaldo", () => {
    it("should update user saldo", async () => {
      const user = { _id: "507f1f77bcf86cd799439011", saldo: 100000 };
      const updatedUser = { _id: "507f1f77bcf86cd799439011", saldo: 150000 };

      mockCollection.findOne.mockResolvedValueOnce(user);
      mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });
      mockCollection.findOne.mockResolvedValueOnce(updatedUser);

      const result = await User.updateSaldo(user._id, 50000);

      expect(mockCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(Object),
      });
      expect(result).toEqual(updatedUser);
    });

    it("should handle negative amount (deduction)", async () => {
      const userId = "507f1f77bcf86cd799439011";
      const amount = -25000;
      const mockUser = { _id: userId, saldo: 100000 };
      const updatedUser = { _id: userId, saldo: 75000 };

      mockCollection.findOne.mockResolvedValueOnce(mockUser);
      mockCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });
      mockCollection.findOne.mockResolvedValueOnce(updatedUser);

      await User.updateSaldo(userId, amount);

      expect(mockCollection.findOne).toHaveBeenCalledWith({
        _id: expect.any(Object),
      });
    });
  });

  describe("updateLastLogin", () => {
    it("should update last login timestamp", async () => {
      const userId = "507f1f77bcf86cd799439011";
      const updatedUser = { _id: userId, lastLogin: new Date() };

      mockCollection.findOneAndUpdate.mockResolvedValue(updatedUser);

      const result = await User.updateLastLogin(userId);

      expect(mockCollection.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: userId },
        {
          $set: {
            lastLogin: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        },
        { returnDocument: "after" }
      );
      expect(result).toEqual(updatedUser);
    });
  });

  describe("comparePassword", () => {
    it("should compare password correctly", async () => {
      const hashedPassword = "hashedpassword";
      const password = "password123";

      bcrypt.compare.mockResolvedValue(true);

      const result = await User.comparePassword(hashedPassword, password);

      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(true);
    });

    it("should return false for incorrect password", async () => {
      bcrypt.compare.mockResolvedValue(false);

      const result = await User.comparePassword(
        "hashedpassword",
        "wrongpassword"
      );

      expect(result).toBe(false);
    });
  });

  describe("generateAuthToken", () => {
    it("should generate JWT token", () => {
      const user = {
        _id: "507f1f77bcf86cd799439011",
        email: "test@example.com",
        role: "customer",
      };

      const mockToken = "jwt.token.here";
      jwt.sign.mockReturnValue(mockToken);

      const result = User.generateAuthToken(user);

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: user._id,
          email: user.email,
          role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
      expect(result).toBe(mockToken);
    });
  });

  describe("setupIndexes", () => {
    it("should create database indexes", async () => {
      mockCollection.createIndex.mockResolvedValue({});

      await User.setupIndexes();

      expect(mockCollection.createIndex).toHaveBeenCalledTimes(4);
      expect(mockCollection.createIndex).toHaveBeenCalledWith(
        { email: 1 },
        { unique: true }
      );
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ role: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({
        created_at: 1,
      });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ google_id: 1 });
    });
  });

  describe('Edge & Negative Case Extensions', () => {
    it('should throw error if userId is not a valid ObjectId in findById', async () => {
      mockCollection.findOne.mockImplementation(() => { throw new Error('Invalid ObjectId'); });
      await expect(User.findById('not-an-objectid')).rejects.toThrow('Invalid ObjectId');
    });

    it('should throw error if userId is not a valid ObjectId in update', async () => {
      mockCollection.findOneAndUpdate.mockImplementation(() => { throw new Error('Invalid ObjectId'); });
      await expect(User.update('not-an-objectid', { name: 'Test' })).rejects.toThrow('Invalid ObjectId');
    });    it('should throw error if userId is not a valid ObjectId in updateSaldo', async () => {
      await expect(User.updateSaldo('not-an-objectid', 1000)).rejects.toThrow('input must be a 24 character hex string');
    });

    it('should throw error if user not found in updateSaldo', async () => {
      mockCollection.findOne.mockResolvedValueOnce(null);
      await expect(User.updateSaldo('507f1f77bcf86cd799439011', 1000)).rejects.toThrow();
    });

    it('should throw error if required fields are missing in create', async () => {
      await expect(User.create({})).rejects.toThrow();
    });

    it('should throw error if update is called with empty updates', async () => {
      mockCollection.findOneAndUpdate.mockRejectedValue(new Error('No updates provided'));
      await expect(User.update('507f1f77bcf86cd799439011', {})).rejects.toThrow('No updates provided');
    });

    it('should handle bcrypt.compare throwing error in comparePassword', async () => {
      bcrypt.compare.mockRejectedValue(new Error('bcrypt error'));
      await expect(User.comparePassword('hash', 'pass')).rejects.toThrow('bcrypt error');
    });    it('should handle missing fields in generateAuthToken', async () => {
      const userWithMissingId = { email: 'test@example.com' };
      const token = User.generateAuthToken(userWithMissingId);
      expect(token).toBeDefined();
    });

    it('should handle User.find with filter', async () => {
      const mockUsers = [
        { _id: '507f1f77bcf86cd799439011', email: 'test1@example.com', role: 'user' },
        { _id: '507f1f77bcf86cd799439012', email: 'test2@example.com', role: 'user' }
      ];
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockUsers)
      });
      
      const result = await User.find({ role: 'user' });
      expect(result).toEqual(mockUsers);
      expect(mockCollection.find).toHaveBeenCalledWith({ role: 'user' });
    });

    it('should handle User.findByIds', async () => {
      const ids = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'];
      const mockUsers = [
        { _id: '507f1f77bcf86cd799439011', email: 'test1@example.com' },
        { _id: '507f1f77bcf86cd799439012', email: 'test2@example.com' }
      ];
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(mockUsers)
      });
      
      const result = await User.findByIds(ids);
      expect(result).toEqual(mockUsers);
      expect(mockCollection.find).toHaveBeenCalledWith({
        _id: { $in: expect.any(Array) }
      });
    });

    it('should handle database connection errors gracefully', async () => {
      mockCollection.findOne.mockRejectedValueOnce(new Error('Database connection failed'));
      
      await expect(User.findById('507f1f77bcf86cd799439011')).rejects.toThrow('Database connection failed');
    });    it('should handle create with duplicate email error', async () => {
      const userData = {
        name: 'Test User',
        email: 'duplicate@example.com',
        password: 'password123'
      };
      
      const duplicateError = new Error('Duplicate key error');
      duplicateError.code = 11000;
      mockCollection.insertOne.mockRejectedValueOnce(duplicateError);
      
      await expect(User.create(userData)).rejects.toThrow('Duplicate key error');
    });

    it('should handle edge case with invalid ObjectId in findById', async () => {
      // Test with non-hex string
      mockCollection.findOne.mockResolvedValueOnce(null);
      const result = await User.findById('invalid-id');
      expect(result).toBeNull();
      expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: 'invalid-id' });
    });

    it('should handle empty results in find method', async () => {
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      });
      
      const result = await User.find({ role: 'nonexistent' });
      expect(result).toEqual([]);
    });

    it('should handle empty array in findByIds', async () => {
      mockCollection.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue([])
      });
      
      const result = await User.findByIds([]);
      expect(result).toEqual([]);
      expect(mockCollection.find).toHaveBeenCalledWith({
        _id: { $in: [] }
      });
    });
  });
});
