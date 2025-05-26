import { Model } from 'mongoloquent';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export class User extends Model {
  static collectionName = 'users';
  
  // Define schema fields and their types
  static schema = {
    email: { type: 'string', required: true, unique: true },
    password: { type: 'string', required: true },
    name: { type: 'string', required: true },
    role: { type: 'string', enum: ['user', 'landowner'], default: 'user' },
    saldo: { type: 'number', default: 0 },
    createdAt: { type: 'date', default: Date.now }
  };

  // Create indexes
  static async createIndexes() {
    await this.collection.createIndex({ email: 1 }, { unique: true });
    await this.collection.createIndex({ createdAt: 1 });
  }

  // Hooks before save
  static async beforeSave(next) {
    if (this.isModified('password')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
    next();
  }

  // Instance methods
  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  generateAuthToken() {
    return jwt.sign(
      { 
        id: this._id,
        email: this.email,
        role: this.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }

  // Static methods for saldo operations
  static async addSaldo(userId, amount) {
    return await this.findByIdAndUpdate(
      userId,
      { $inc: { saldo: amount } },
      { new: true }
    );
  }

  static async deductSaldo(userId, amount) {
    const user = await this.findById(userId);
    if (!user || user.saldo < amount) {
      throw new Error('Saldo tidak mencukupi');
    }
    return await this.findByIdAndUpdate(
      userId,
      { $inc: { saldo: -amount } },
      { new: true }
    );
  }

  // Get user's parkings (for landowner)
  static async getParkings(userId) {
    return await this.model('Parking').find({ ownerId: userId });
  }
} 