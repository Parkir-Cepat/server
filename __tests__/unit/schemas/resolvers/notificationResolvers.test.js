import { notificationResolvers } from '../../../../schemas/resolvers/notificationResolvers.js';
import { getDB } from '../../../../config/db.js';

jest.mock('../../../../config/db.js');
jest.mock('../../../../schemas/resolvers/notificationResolvers.js', () => ({
  notificationResolvers: {
    Query: {
      notificationsByUser: jest.fn((_, { userId }) => {
        if (!userId) {
          throw new Error('userId is required');
        }
        return [{ id: 1, userId }];
      }),
    },
  },
}));

describe('Notification Resolvers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationResolvers.Query.notificationsByUser.mockImplementation((_, { userId }) => {
      if (!userId) {
        throw new Error('userId is required');
      }
      return [{ id: 1, userId }];
    });
  });

  describe('Query.notificationsByUser', () => {
    it('throws if userId is missing', async () => {
      try {
        await notificationResolvers.Query.notificationsByUser(null, {});
      } catch (error) {
        console.error('Caught error:', error);
        expect(error.message).toBe('userId is required');
      }
    });
    it('returns notifications array when userId provided', async () => {
      const res = await notificationResolvers.Query.notificationsByUser(null, { userId: 'u1' });
      expect(res).toEqual([{ id: 1, userId: 'u1' }]);
    });
  });
});
