import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

let db = null;

/**
 * Inisialisasi koneksi ke MongoDB
 */
export const connectDB = async () => {
  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    db = client.db();
    console.log('🗄️  Terhubung ke MongoDB');

    // Setup indexes untuk semua collection
    await setupIndexes();
  } catch (error) {
    console.error('❌ Error koneksi ke MongoDB:', error);
    process.exit(1);
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

/**
 * Setup indexes untuk semua collection
 */
const setupIndexes = async () => {
  try {
    // Import model classes
    const { User } = await import('../models/User.js');
    const { ParkingLot } = await import('../models/ParkingLot.js');
    const { Booking } = await import('../models/Booking.js');
    const { Payment } = await import('../models/Payment.js');
    const { SaldoTransaction } = await import('../models/SaldoTransaction.js');
    const { Chat } = await import('../models/Chat.js');

    // Setup indexes untuk setiap collection
    await Promise.all([
      User.setupIndexes(),
      ParkingLot.setupIndexes(),
      Booking.setupIndexes(),
      Payment.setupIndexes(),
      SaldoTransaction.setupIndexes(),
      Chat.setupIndexes()
    ]);

    console.log('📑 Indexes berhasil dibuat');
  } catch (error) {
    console.error('❌ Error setup indexes:', error);
    throw error;
  }
};
