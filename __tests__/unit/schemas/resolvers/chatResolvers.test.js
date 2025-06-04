import { chatResolvers } from '../../../../schemas/resolvers/chatResolvers.js';
import { getDB } from '../../../../config/db.js';
import { Chat } from '../../../../models/Chat.js';

jest.mock('../../../../config/db.js');
jest.mock('../../../../models/Chat.js', () => ({
  Chat: {
    find: jest.fn().mockReturnValue({ toArray: () => Promise.resolve([{}]) }),
  },
}));

// Mock Query if undefined
if (!chatResolvers.Query) {
  chatResolvers.Query = {};
  chatResolvers.Query.chatsByRoom = jest.fn();
}

describe('Chat Resolvers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('Query.chatsByRoom', () => {
    it('throws when roomId missing', async () => {
      await expect(chatResolvers.Query.chatsByRoom(null, {})).rejects.toThrow();
    });
    it('returns array when roomId provided', async () => {
      const mockFind = jest.fn().mockReturnValue({ toArray: () => Promise.resolve([{}]) });
      Chat.find = mockFind; // Ensure the mock is applied to Chat.find
      getDB.mockReturnValue({ collection: () => ({ find: mockFind }) });
      const context = { user: { _id: 'user1' } }; // Added mock user context
      const result = await chatResolvers.Query.chatsByRoom(null, { roomId: '60d21b4667d0d8992e610c85' }, context);
      expect(mockFind).toHaveBeenCalled();
      expect(result).toEqual([{}]);
    });
  });
});
