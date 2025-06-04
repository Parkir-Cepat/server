import { roomResolvers } from '../../../../schemas/resolvers/roomResolvers.js';
import { getDB } from '../../../../config/db.js';
import { Room } from '../../../../models/Room.js';

jest.mock('../../../../config/db.js');
jest.mock('../../../../models/Room.js', () => ({
  Room: {
    find: jest.fn(() => ({
      toArray: jest.fn(() => Promise.resolve([{ _id: 'r1' }, { _id: 'r2' }])),
    })),
  },
}));

describe('Room Resolvers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('Query.rooms', () => {
    it('returns all rooms', async () => {
      const rooms = [{ _id: 'r1' }, { _id: 'r2' }];
      Room.find.mockReturnValue({
        toArray: jest.fn().mockResolvedValue(rooms),
      });
      const res = await roomResolvers.Query.rooms();
      expect(Room.find).toHaveBeenCalled();
      expect(res).toEqual(rooms);
    });
  });
});
