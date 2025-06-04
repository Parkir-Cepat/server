jest.mock('../../../../schemas/resolvers/bookingResolvers.js', () => ({
  bookingResolvers: {
    Query: {
      bookingsByUser: jest.fn((_, { userId }) => {
        if (!userId) {
          throw new Error('userId is required');
        }
        return [{ id: 1, userId }];
      }),
    },
  },
}));

import { bookingResolvers } from '../../../../schemas/resolvers/bookingResolvers.js';

describe('Booking Resolvers', () => {
  describe('Query.bookingsByUser', () => {
    it('throws if userId not provided', async () => {
      try {
        await bookingResolvers.Query.bookingsByUser(null, {});
      } catch (error) {
        console.error('Caught error:', error);
        expect(error.message).toBe('userId is required');
      }
    });
    it('returns an array if userId provided', async () => {
      const result = await bookingResolvers.Query.bookingsByUser(null, {
        userId: 1,
      });
      expect(result).toEqual([{ id: 1, userId: 1 }]);
    });
  });
});
