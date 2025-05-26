import { getDB } from '../config/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export class User {
  static collection = 'users';

  /**
   * Setup indexes untuk collection
   */
  static async setupIndexes() {
    const db = getDB();
    await Promise.all([
      db.collection(this.collection).createIndex({ email: 1 }, { unique: true }),
      db.collection(this.collection).createIndex({ role: 1 }),
      db.collection(this.collection).createIndex({ createdAt: 1 })
    ]);
  }

  /**
   * Mencari user berdasarkan ID
   * @param {string} id - ID user
   * @returns {Promise<Object>} User document
   */
  static async findById(id) {
    const db = getDB();
    return await db.collection(this.collection).findOne({ _id: id });
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
   * Membuat user baru
   * @param {Object} userData - Data user
   * @returns {Promise<Object>} User document yang baru dibuat
   */
  static async create(userData) {
    const db = getDB();
    const { email, password, name, role = 'user' } = userData;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await db.collection(this.collection).insertOne({
      email,
      password: hashedPassword,
      name,
      role,
      saldo: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return {
      _id: result.insertedId,
      email,
      name,
      role,
      saldo: 0,
      createdAt: new Date(),
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
      updatedAt: new Date()
    };

    // Jika ada update password, hash dulu
    if (updates.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(updates.password, salt);
    }

    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: id },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    return result.value;
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
      { _id: id },
      { 
        $inc: { saldo: amount },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    return result.value;
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
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }
} 