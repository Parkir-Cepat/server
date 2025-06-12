import { getDB } from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

export class User {
  static collection = "users";

  /**
   * Setup indexes untuk collection
   */
  static async setupIndexes() {
    const db = getDB();
    await Promise.all([
      db
        .collection(this.collection)
        .createIndex({ email: 1 }, { unique: true }),
      db.collection(this.collection).createIndex({ role: 1 }),
      db.collection(this.collection).createIndex({ created_at: 1 }),
      db.collection(this.collection).createIndex({ google_id: 1 }),
    ]);
  }

  /**
   * Mencari user berdasarkan ID
   * @param {string} id - ID user
   * @returns {Promise<Object>} User document
   */
  static async findById(id) {
    const db = getDB();
    let queryId = id;
    if (typeof id === "string" && /^[a-fA-F0-9]{24}$/.test(id)) {
      queryId = new ObjectId(id);
    }
    return await db.collection(this.collection).findOne({ _id: queryId });
  }

  /**
   * Mencari user berdasarkan email
   * @param {string} email - Email user
   * @returns {Promise<Object>} User document
   */
  static async findByEmail(email) {
    const db = getDB();
    return await db.collection(this.collection).findOne({ email });
  }

  /**
   * Mencari user berdasarkan Google ID
   * @param {string} googleId - Google ID user
   * @returns {Promise<Object>} User document
   */
  static async findByGoogleId(googleId) {
    const db = getDB();
    return await db.collection(this.collection).findOne({ googleId });
  }

  /**
   * Update last login user
   * @param {string} id - ID user
   * @returns {Promise<Object>} Updated user document
   */
  static async updateLastLogin(id) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: id },
      {
        $set: {
          lastLogin: new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );
    return result;
  }

  /**
   * Membuat user baru
   * @param {Object} userData - Data user
   * @returns {Promise<Object>} User document yang baru dibuat
   */
  static async create(userData) {
    const db = getDB();
    const {
      email,
      password,
      name,
      role = "user",
      googleId = null,
      avatar = null,
      isEmailVerified = false,
    } = userData;

    // Hash password jika ada dan bukan dari Google Auth
    let hashedPassword = null;
    if (password) {
      if (!password.startsWith("GOOGLE_AUTH_")) {
        const salt = await bcrypt.genSalt(10);
        hashedPassword = await bcrypt.hash(password, salt);
      } else {
        hashedPassword = password;
      }
    }

    // Generate random password for Google Auth users if no password provided
    if (!hashedPassword && googleId) {
      const randomPassword =
        "GOOGLE_AUTH_" + Math.random().toString(36).substring(7);
      const salt = await bcrypt.genSalt(10);
      hashedPassword = await bcrypt.hash(randomPassword, salt);
    }

    // Throw error if no password and not Google Auth
    if (!hashedPassword && !googleId) {
      throw new Error("Password is required for non-Google Auth users");
    }

    const result = await db.collection(this.collection).insertOne({
      email,
      password: hashedPassword,
      name,
      role,
      saldo: 0,
      google_id: googleId,
      avatar,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return {
      _id: result.insertedId,
      email,
      name,
      role,
      saldo: 0,
      google_id: googleId,
      avatar,
      created_at: new Date(),
    };
  }

  /**
   * Update profil user
   * @param {string} id - ID user
   * @param {Object} updates - Data yang akan diupdate
   * @returns {Promise<Object>} Updated user document
   */
  static async update(id, updates) {
    const db = getDB();
    const updateData = {
      ...updates,
      updated_at: new Date(),
    };

    // Jika ada update password, hash dulu
    if (updates.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updates.password, salt);
    }
    const result = await db
      .collection(this.collection)
      .findOneAndUpdate(
        { _id: id },
        { $set: updateData },
        { returnDocument: "after" }
      );

    return result;
  }

  /**
   * Update saldo user
   * @param {string} id - ID user
   * @param {number} amount - Jumlah perubahan saldo (positif untuk penambahan, negatif untuk pengurangan)
   * @returns {Promise<Object>} Updated user document
   */
  static async updateSaldo(id, amount) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $inc: { saldo: amount },
        $set: { updated_at: new Date() },
      },
      { returnDocument: "after" }
    );

    return result;
  }

  /**
   * Update saldo user dengan enhanced logging
   * @param {string} userId - ID user
   * @param {number} amount - Jumlah perubahan saldo (positif untuk penambahan, negatif untuk pengurangan)
   * @returns {Promise<Object>} Updated user document
   */
  static async updateSaldo(userId, amount) {
    try {
      console.log(`💰 Updating saldo for user ${userId}, amount: ${amount}`);

      const db = getDB();

      // Convert userId to ObjectId if it's a string
      let objectId;
      if (typeof userId === "string") {
        objectId = new ObjectId(userId);
      } else {
        objectId = userId;
      }

      const user = await db
        .collection(this.collection)
        .findOne({ _id: objectId });

      if (!user) {
        console.error(`❌ User not found: ${userId}`);
        throw new Error("User not found for saldo update");
      }

      const currentSaldo = user.saldo || 0;
      const newSaldo = currentSaldo + amount;

      console.log(`💰 Saldo update: ${currentSaldo} + ${amount} = ${newSaldo}`);

      if (newSaldo < 0) {
        console.error(
          `❌ Insufficient balance: ${currentSaldo} + ${amount} = ${newSaldo}`
        );
        throw new Error("Insufficient balance");
      }

      // Use updateOne instead of findOneAndUpdate for more reliable results
      const updateResult = await db.collection(this.collection).updateOne(
        { _id: objectId },
        {
          $set: {
            saldo: newSaldo,
            updated_at: new Date(),
          },
        }
      );

      console.log(`🔍 Update result:`, updateResult);

      if (updateResult.modifiedCount === 0) {
        console.error(`❌ Failed to update user saldo for user: ${userId}`);
        throw new Error("Failed to update user saldo");
      }

      // Fetch the updated user
      const updatedUser = await db
        .collection(this.collection)
        .findOne({ _id: objectId });

      console.log(
        `✅ Saldo updated successfully for user ${userId}: ${updatedUser.saldo}`
      );
      return updatedUser;
    } catch (error) {
      console.error("❌ Error updating user saldo:", error);
      throw error;
    }
  }

  /**
   * Membandingkan password
   * @param {string} hashedPassword - Password yang sudah di-hash
   * @param {string} password - Password yang akan dibandingkan
   * @returns {Promise<boolean>} Hasil perbandingan
   */
  static async comparePassword(hashedPassword, password) {
    return await bcrypt.compare(password, hashedPassword);
  }

  /**
   * Generate JWT token
   * @param {Object} user - User document
   * @returns {string} JWT token
   */
  static generateAuthToken(user) {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
  }

  /**
   * Find users by role
   * @param {Object} filter - Filter criteria
   * @returns {Promise<Array<Object>>} Array of user documents
   */
  static async find(filter) {
    const db = getDB();
    return await db.collection(this.collection).find(filter).toArray();
  }

  /**
   * Mencari multiple users berdasarkan array ID
   * @param {Array<string>} ids - Array of user IDs
   * @returns {Promise<Array<Object>>} Array of user documents
   */
  static async findByIds(ids) {
    const db = getDB();
    const objectIds = ids.map((id) => new ObjectId(id));
    return await db
      .collection(this.collection)
      .find({ _id: { $in: objectIds } })
      .toArray();
  }
}
