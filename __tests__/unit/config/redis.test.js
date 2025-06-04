import Redis from 'ioredis';
import redisClient from '../../../config/redis';

describe('Redis Configuration', () => {
  let mockRedis;

  beforeEach(() => {
    mockRedis = jest.spyOn(Redis.prototype, 'connect').mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should initialize Redis client with correct configuration', () => {
    expect(redisClient.options).toMatchObject({
      username: 'default',
      password: process.env.REDIS_PASSWORD,
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT),
    });
  });

  test('should handle Redis client errors', () => {
    const errorHandler = jest.fn();
    redisClient.on('error', errorHandler);

    const testError = new Error('Test Redis Error');
    redisClient.emit('error', testError);

    expect(errorHandler).toHaveBeenCalledWith(testError);
  });

  test('should have Redis client methods available', () => {
    expect(typeof redisClient.get).toBe('function');
    expect(typeof redisClient.set).toBe('function');
    expect(typeof redisClient.del).toBe('function');
  });
});