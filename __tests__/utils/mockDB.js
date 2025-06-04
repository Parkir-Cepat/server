/**
 * Mock implementation for database connection in tests
 */

// Mock collection operations
export const mockCollection = {
  findOne: jest.fn(),
  find: jest.fn(() => ({
    toArray: jest.fn().mockResolvedValue([]),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis()
  })),
  insertOne: jest.fn().mockResolvedValue({ insertedId: 'mock-id' }),
  updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
  updateMany: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
  deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  deleteMany: jest.fn().mockResolvedValue({ deletedCount: 2 }),
  countDocuments: jest.fn().mockResolvedValue(0),
  createIndex: jest.fn().mockResolvedValue('index-name'),
  aggregate: jest.fn().mockReturnValue({
    toArray: jest.fn().mockResolvedValue([])
  })
};

// Mock database instance
export const mockDB = {
  collection: jest.fn().mockReturnValue(mockCollection)
};

// Mock MongoClient
export const mockMongoClient = {
  db: jest.fn().mockReturnValue(mockDB),
  close: jest.fn()
};

// Export mocked functions to replace the actual ones in db.js
export const getDB = jest.fn().mockReturnValue(mockDB);
export const getMongoClient = jest.fn().mockReturnValue(mockMongoClient);
export const connectDB = jest.fn().mockResolvedValue(null);
