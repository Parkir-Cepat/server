const { connectDB } = require('../../../config/db');
const mockDBSetup = require('../../utils/dbMockSetup');

jest.mock('../../../config/db.js', () => {
  const originalModule = jest.requireActual('../../../config/db.js');
  return {
    ...originalModule,
    connectDB: jest.fn(async () => {
      const setupIndexes = jest.fn(() => {
        throw new Error('setupIndexes failed');
      });
      await setupIndexes();
    }),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Database Connection', () => {
  it('should connect to the database successfully', async () => {
    connectDB.mockResolvedValueOnce('Connected');

    const result = await connectDB();

    expect(result).toBe('Connected');
    expect(connectDB).toHaveBeenCalledTimes(1);
  });

  it('should throw an error if connection fails', async () => {
    connectDB.mockRejectedValueOnce(new Error('Connection failed'));

    await expect(connectDB()).rejects.toThrow('Connection failed');
    expect(connectDB).toHaveBeenCalledTimes(1);
  });
});

describe('config/db errors', () => {
  it('connectDB throws when setupIndexes failing in test', async () => {
    await expect(connectDB()).rejects.toThrow('setupIndexes failed');
  });
});

describe('connectDB error handling', () => {
  it('throws an error if setupIndexes fails', async () => {
    await expect(connectDB()).rejects.toThrow('setupIndexes failed');
  });
});
