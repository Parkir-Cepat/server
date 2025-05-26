import { MongoClient } from 'mongodb';
import { Model } from 'mongoloquent';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/parkir_cepat';

export const connectDB = async () => {
  try {
    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db();
    
    // Initialize Mongoloquent with the MongoDB connection
    Model.setConnection(db);
    
    console.log('📦 Connected to MongoDB successfully');
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}; 