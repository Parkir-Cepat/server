import { Parking } from '../../../graphql/schemas/parkingSchema';
import { getDB } from '../../../config/db';
import { gql } from 'apollo-server-express';

jest.mock('../../../config/db', () => ({
  getDB: jest.fn()
}));

describe('Parking Schema', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setupIndexes', () => {
    it('should create indexes for the parking collection', async () => {
      const mockCollection = {
        createIndex: jest.fn()
      };
      const mockDb = {
        collection: jest.fn(() => mockCollection)
      };
      getDB.mockReturnValue(mockDb);

      await Parking.setupIndexes();

      expect(mockDb.collection).toHaveBeenCalledWith('parkings');
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ location: '2dsphere' });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ owner_id: 1 });
      expect(mockCollection.createIndex).toHaveBeenCalledWith({ created_at: 1 });
    });

    it('should handle errors during index creation gracefully', async () => {
      const mockCollection = {
        createIndex: jest.fn(() => {
          throw new Error('Index creation failed');
        })
      };
      const mockDb = {
        collection: jest.fn(() => mockCollection)
      };
      getDB.mockReturnValue(mockDb);

      await expect(Parking.setupIndexes()).rejects.toThrow('Index creation failed');

      expect(mockDb.collection).toHaveBeenCalledWith('parkings');
      expect(mockCollection.createIndex).toHaveBeenCalled();
    });
  });
});
