import { mockContext } from '../../utils/mockContext';
import { resolvers } from '../../../schemas/schema';
import { GraphQLError, Kind } from 'graphql';

describe('Parking Resolvers', () => {
  let context;

  beforeEach(() => {
    context = {
      db: {
        collection: jest.fn().mockReturnValue({
          find: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue([])
          }),
          aggregate: jest.fn().mockReturnValue({
            toArray: jest.fn().mockResolvedValue([])
          })
        })
      }
    };
  });

  describe('Query.nearbyParkings', () => {
    const mockParkings = [
      {
        _id: 'parking1',
        name: 'Parking A',
        location: {
          type: 'Point',
          coordinates: [106.8456, -6.2088] // longitude, latitude
        },
        availableSlots: 10,
        totalSlots: 20,
        tariff: 5000
      },
      {
        _id: 'parking2',
        name: 'Parking B',
        location: {
          type: 'Point',
          coordinates: [106.8256, -6.2188]
        },
        availableSlots: 5,
        totalSlots: 15,
        tariff: 4000
      }
    ];

    it('should return empty array when no parkings found', async () => {
      context.db.collection('parkings').find.mockReturnValueOnce({
        toArray: jest.fn().mockResolvedValueOnce([])
      });

      const result = await resolvers.Query.nearbyParkings(
        null,
        {
          lat: 0,
          lng: 0,
          radius: 1000
        },
        context
      );

      expect(result).toHaveLength(0);
    });
  });
});
