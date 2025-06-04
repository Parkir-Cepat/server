import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getDB, getMongoClient } from '../../config/db.js';

// Error message mappings to handle localization or different error messages
export const ERROR_MESSAGE_MAP = {
  'Authentication required': 'Anda harus login terlebih dahulu',
  'Current password is incorrect': 'Password lama tidak sesuai',
  'New password must be at least 6 characters': 'Password baru minimal harus 6 karakter',
  'Admin access required': 'Admin access required',
  'Email already in use': 'Email sudah digunakan',
  'Invalid email/password': 'Email atau password tidak valid',
  'User not found': 'User tidak ditemukan',
  'Google authentication failed': 'Autentikasi Google gagal',
};

// Mock data generators
export const mockUser = {
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  saldo: 100000,
  googleId: null,
  avatar: null,
  isEmailVerified: false,
  lastLogin: new Date(),
  createdAt: new Date(),
  updatedAt: new Date()
};

export const mockParkingLot = {
  name: 'Test Parking Lot',
  address: 'Jl. Test No. 123',
  location: {
    type: 'Point',
    coordinates: [106.8456, -6.2088]
  },
  capacity: { car: 10, motorcycle: 20 },
  rates: { car: 5000, motorcycle: 2000 },
  operationalHours: { open: '06:00', close: '22:00' },
  facilities: ['CCTV', 'Security'],
  images: ['image1.jpg'],  status: 'active',
  rating: 0,
  review_count: 0,
  created_at: new Date(),
  updated_at: new Date()
};

/**
 * Checks if the error message matches any of the expected messages, allowing for 
 * translation differences
 * @param {Error} error - The error object
 * @param {string} expectedMessage - The expected error message in English
 * @returns {boolean} - True if the message matches
 */
export const errorMessageMatches = (error, expectedMessage) => {
  // Check direct match
  if (error.message === expectedMessage) {
    return true;
  }
  
  // Check mapped message
  const mappedMessage = ERROR_MESSAGE_MAP[expectedMessage];
  if (mappedMessage && error.message === mappedMessage) {
    return true;
  }
  
  // Check partial match (useful for GraphQL errors that include extensions)
  if (mappedMessage && error.message.includes(mappedMessage)) {
    return true;
  }
  
  if (expectedMessage && error.message.includes(expectedMessage)) {
    return true;
  }
  
  return false;
};

export const mockBooking = {
  start_time: new Date(),
  end_time: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours later
  status: 'active',
  cost: 10000,
  vehicle_type: 'car',
  duration: 2,
  qr_code: 'test-qr-code',
  created_at: new Date(),
  updated_at: new Date()
};

// Authentication helpers
export const generateTestToken = (userId, role = 'user') => {
  const tokenUserId = userId || new ObjectId().toString();
  return jwt.sign(
    { id: tokenUserId, role },
    process.env.JWT_SECRET || 'test-jwt-secret',
    { expiresIn: '1h' }
  );
};

export const createTestUser = async (db = null, userData = {}) => {
  const database = db || getDB();
  const hashedPassword = await bcrypt.hash('password123', 10);
  const user = {
    ...mockUser,
    ...userData,
    password: hashedPassword
  };
  if (!user._id) user._id = new ObjectId();
  const result = await database.collection('users').insertOne(user);
  return { ...user, _id: result.insertedId };
};

export const createTestParkingLot = async (db = null, parkingLotData = {}) => {
  const database = db || getDB();
  let location = mockParkingLot.location;
  if (parkingLotData.location) {
    location = {
      type: 'Point',
      coordinates: parkingLotData.location.coordinates || mockParkingLot.location.coordinates
    };
  }
  let ownerId = parkingLotData.ownerId || mockParkingLot.ownerId;
  if (ownerId && typeof ownerId === 'string' && /^[a-fA-F0-9]{24}$/.test(ownerId)) {
    ownerId = new ObjectId(ownerId);
  }
  const parkingLot = {
    ...mockParkingLot,
    ...parkingLotData,
    location,
    ownerId
  };
  const result = await database.collection('parking_lots').insertOne(parkingLot);
  return { ...parkingLot, _id: result.insertedId };
};

export const createTestBooking = async (db = null, bookingData = {}) => {
  const database = db || getDB();
  const booking = {
    ...mockBooking,
    ...bookingData
  };
  const result = await database.collection('bookings').insertOne(booking);
  return { ...booking, _id: result.insertedId };
};

// Database cleanup
export const cleanupDatabase = async (db) => {
  const collections = ['users', 'parkings', 'bookings', 'notifications', 'chats', 'payments'];
  for (const collection of collections) {
    await db.collection(collection).deleteMany({});
  }
};

// GraphQL query helpers
export const createGraphQLQuery = (query, variables = {}) => {
  return {
    query,
    variables
  };
};

// Mock external services
export const mockMidtransResponse = {
  token: 'test-midtrans-token',
  redirect_url: 'https://app.sandbox.midtrans.com/snap/test-token'
};

export const mockGoogleMapsResponse = {
  data: {
    results: [
      {
        geometry: {
          location: {
            lat: -6.2088,
            lng: 106.8456
          }
        },
        formatted_address: 'Jl. Test No. 123, Jakarta'
      }
    ]
  }
};

// Error helpers
export const expectGraphQLError = (response, errorMessage) => {
  expect(response.body.errors).toBeDefined();
  expect(response.body.errors[0].message).toContain(errorMessage);
};

export const expectGraphQLSuccess = (response) => {
  expect(response.body.errors).toBeUndefined();
  expect(response.body.data).toBeDefined();
};