import dotenv from 'dotenv';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test timeout
jest.setTimeout(30000);

// Global test setup
let mongoServer;

// Set agar MongoMemoryServer listen di 127.0.0.1 (bukan 0.0.0.0)
process.env.MONGOMS_IP = '127.0.0.1';

// Hanya jalankan MongoMemoryServer jika diperlukan (misal, untuk integration test)
if (process.env.UNIT_DB !== 'false') {
  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create({
      instance: {
        port: 27017, // Use a fixed port to avoid conflicts
      },
    });
    const mongoUri = mongoServer.getUri();
    
    // Set test database URI
    process.env.MONGODB_URI = mongoUri;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.MIDTRANS_SERVER_KEY = 'test-midtrans-key';
    process.env.GOOGLE_MAPS_API_KEY = 'test-google-maps-key';
    process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
    process.env.SESSION_SECRET = 'test-session-secret';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    process.env.CLIENT_URL = 'http://localhost:3000';
  });

  afterAll(async () => {
    // Stop in-memory MongoDB instance
    if (mongoServer) {
      await mongoServer.stop();
    }
  });
}

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};