import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test timeout
jest.setTimeout(30000);

// Set test environment variables without MongoDB
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.MIDTRANS_SERVER_KEY = 'test-midtrans-key';
process.env.GOOGLE_MAPS_API_KEY = 'test-google-maps-key';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.REDIS_URL = 'redis://localhost:6379';
