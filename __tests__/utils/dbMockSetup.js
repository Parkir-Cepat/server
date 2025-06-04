// Mock the database module
const mockDB = {};
const mockClient = {};

jest.mock('../../config/db.js', () => ({
  getDB: jest.fn(() => mockDB),
  getMongoClient: jest.fn(() => mockClient),
  connectDB: jest.fn(),
  closeDB: jest.fn(),
}));

export { mockDB, mockClient };
