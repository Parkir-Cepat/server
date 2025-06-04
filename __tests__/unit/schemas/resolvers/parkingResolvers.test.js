import { parkingResolvers } from '../../../../schemas/resolvers/parkingResolvers.js';
import { getDB } from '../../../../config/db.js';
import { Parking } from '../../../../models/Parking.js';

jest.mock('../../../../config/db.js');
jest.mock('../../../../models/Parking.js', () => ({
  Parking: {
    find: jest.fn().mockReturnValue({ toArray: () => Promise.resolve([{ id: 1 }]) }),
  },
}));

describe('Parking Resolvers', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('Query.parkingsByOwner', () => {
    it('throws if ownerId missing', async () => {
      await expect(parkingResolvers.Query.parkingsByOwner(null, {})).rejects.toThrow();
    });
    it('returns array when ownerId provided', async () => {
      const mockFind = jest.fn().mockReturnValue({ toArray: () => Promise.resolve([{ id: 1 }]) });
      Parking.find = mockFind; // Ensure the mock is applied to Parking.find
      getDB.mockReturnValue({ collection: () => ({ find: mockFind }) });
      const context = { user: { _id: 'user1' } }; // Added mock user context
      const res = await parkingResolvers.Query.parkingsByOwner(null, { ownerId: 'o1' }, context);
      expect(mockFind).toHaveBeenCalled();
      expect(res).toEqual([{ id: 1 }]);
    });
  });
});
