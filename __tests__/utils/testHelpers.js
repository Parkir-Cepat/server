import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { getDB, getMongoClient } from '../../config/db.js';

// Mock data generators
export const mockUser = {
  email: 'test@example.com',
  name: 'Test User',
  role: 'customer',
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
  images: ['image1.jpg'],
  status: 'active',
  rating: 0,
  reviewCount: 0,
  createdAt: new Date(),
  updatedAt: new Date()
};

export const mockBooking = {
  startTime: new Date(),
  endTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours later
  totalPrice: 10000,
  status: 'active',
  qrCode: 'test-qr-code',
  createdAt: new Date(),
  updatedAt: new Date()
};

// Authentication helpers
export const generateTestToken = (userId, role = 'customer') => {
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
export const cleanupDatabase = async () => {
  const database = getDB();
  // Clear all collections
  const collections = ['users', 'parking_lots', 'bookings', 'payments', 'saldoTransactions', 'chats', 'notifications'];
  for (const collection of collections) {
    await database.collection(collection).deleteMany({});
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