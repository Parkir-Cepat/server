const { connectDB } = require('../../../config/db');
const mockDBSetup = require('../../utils/dbMockSetup');

jest.mock('../../../config/db');

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
