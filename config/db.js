import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let db = null;
let client = null;

/**
 * Inisialisasi koneksi ke MongoDB
 */
export const connectDB = async () => {
  try {
    client = await MongoClient.connect(process.env.MONGODB_URI);
    db = client.db('PARKIRIN'); // Set database name to PARKIRIN
    console.log('🗄️  Terhubung ke MongoDB database: PARKIRIN');

    // Setup indexes untuk semua collection
    await setupIndexes();
  } catch (error) {
    console.error('❌ Error koneksi ke MongoDB:', error);
    
    // Don't exit process in test environment
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    } else {
      throw error; // Throw error instead of exiting in test environment
    }
  }
};

/**
 * Mendapatkan instance database
 * @returns {Db} Instance MongoDB database
 */
export const getDB = () => {
  if (!db) {
    throw new Error('Database belum diinisialisasi');
  }
  return db;
};

export const getMongoClient = () => {
  if (!client) {
    throw new Error('MongoClient belum diinisialisasi');
  }
  return client;
};

/**
 * Setup indexes untuk semua collection
 */
const setupIndexes = async () => {
  try {
    // Import model classes
    const { User } = await import('../models/User.js');
    const { Parking } = await import('../models/Parking.js');
    const { Booking } = await import('../models/Booking.js');
    const { Transaction } = await import('../models/Transaction.js');
    const { Chat } = await import('../models/Chat.js');
    const { Room } = await import('../models/Room.js');
    const { UserRoom } = await import('../models/UserRoom.js');

    // Setup indexes untuk setiap collection
    await Promise.all([
      User.setupIndexes(),
      Parking.setupIndexes(),
      Booking.setupIndexes(),
      Transaction.setupIndexes(),
      Chat.setupIndexes(),
      Room.setupIndexes(),
      UserRoom.setupIndexes()
    ]);

    console.log('📑 Indexes berhasil dibuat');
  } catch (error) {
    console.error('❌ Error setup indexes:', error);
    throw error;
  }
};
