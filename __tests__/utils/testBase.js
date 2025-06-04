// filepath: e:\Latihan-Coding\Hacktiv8\phase3\FINAL PROJECT\server\__tests__\utils\testBase.js
import { ObjectId } from 'mongodb';
import { setupTestDB, teardownTestDB } from './setupTestDB.js';
import { createTestServer, executeTestQuery } from './testServer.js';

export const createTestContext = (mockUser = null) => {
  let testServer;

  beforeAll(async () => {
    await setupTestDB();
    testServer = createTestServer({ user: mockUser });
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  return {
    testServer,
    executeQuery: (query, variables = {}, context = {}) => 
      executeTestQuery(testServer, query, variables, context)
  };
};

export const generateMockIds = (count = 1) => {
  const ids = [];
  for (let i = 0; i < count; i++) {
    ids.push(new ObjectId());
  }
  return count === 1 ? ids[0] : ids;
};

export const mockDateTime = (isoString) => new Date(isoString);

export const formatISODate = (date) => date.toISOString();
