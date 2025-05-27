// Set environment variable before importing
process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';

// Mock Google Maps client
const mockClient = {
  geocode: jest.fn(),
  reverseGeocode: jest.fn(),
  distancematrix: jest.fn(),
  directions: jest.fn(),
  placesNearby: jest.fn()
};

jest.mock('@googlemaps/google-maps-services-js', () => ({
  Client: jest.fn().mockImplementation(() => mockClient)
}));

const GoogleMapsHelper = require('../../../helpers/googleMaps.js');

describe('Google Maps Helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set environment variable for tests
    process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';
  });

  describe('geocode', () => {
    it('should geocode address successfully', async () => {
      const mockResponse = {
        data: {
          results: [{
            geometry: {
              location: { lat: -6.2088, lng: 106.8456 }
            },
            formatted_address: 'Jakarta, Indonesia'
          }]
        }
      };

      mockClient.geocode.mockResolvedValue(mockResponse);

      const result = await GoogleMapsHelper.geocode('Jakarta, Indonesia');

      expect(mockClient.geocode).toHaveBeenCalledWith({
        params: {
          address: 'Jakarta, Indonesia',
          key: 'test-api-key'
        }
      });
      expect(result).toEqual(mockResponse.data.results[0]);
    });

    it('should throw error when geocoding fails', async () => {
      mockClient.geocode.mockRejectedValue(new Error('API Error'));

      await expect(GoogleMapsHelper.geocode('Invalid Address'))
        .rejects.toThrow('Failed to geocode address');
    });

    it('should handle empty address', async () => {
      mockClient.geocode.mockRejectedValue(new Error('Invalid request'));

      await expect(GoogleMapsHelper.geocode(''))
        .rejects.toThrow('Failed to geocode address');
    });
  });

  describe('reverseGeocode', () => {
    it('should reverse geocode coordinates successfully', async () => {
      const mockResponse = {
        data: {
          results: [{
            formatted_address: 'Jl. Sudirman, Jakarta',
            address_components: []
          }]
        }
      };

      mockClient.reverseGeocode.mockResolvedValue(mockResponse);

      const result = await GoogleMapsHelper.reverseGeocode(-6.2088, 106.8456);

      expect(mockClient.reverseGeocode).toHaveBeenCalledWith({
        params: {
          latlng: { lat: -6.2088, lng: 106.8456 },
          key: 'test-api-key'
        }
      });
      expect(result).toEqual(mockResponse.data.results[0]);
    });

    it('should throw error when reverse geocoding fails', async () => {
      mockClient.reverseGeocode.mockRejectedValue(new Error('API Error'));

      await expect(GoogleMapsHelper.reverseGeocode(999, 999))
        .rejects.toThrow('Failed to reverse geocode coordinates');
    });

    it('should handle invalid coordinates', async () => {
      mockClient.reverseGeocode.mockRejectedValue(new Error('Invalid coordinates'));

      await expect(GoogleMapsHelper.reverseGeocode(null, null))
        .rejects.toThrow('Failed to reverse geocode coordinates');
    });
  });

  describe('getDistanceMatrix', () => {
    it('should get distance matrix successfully', async () => {
      const mockResponse = {
        data: {
          rows: [{
            elements: [{
              distance: { text: '5.2 km', value: 5200 },
              duration: { text: '15 mins', value: 900 }
            }]
          }]
        }
      };

      mockClient.distancematrix.mockResolvedValue(mockResponse);

      const origins = ['Jakarta'];
      const destinations = ['Bogor'];
      const result = await GoogleMapsHelper.getDistanceMatrix(origins, destinations);

      expect(mockClient.distancematrix).toHaveBeenCalledWith({
        params: {
          origins,
          destinations,
          key: 'test-api-key'
        }
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should throw error when distance matrix fails', async () => {
      mockClient.distancematrix.mockRejectedValue(new Error('API Error'));

      await expect(GoogleMapsHelper.getDistanceMatrix(['A'], ['B']))
        .rejects.toThrow('Failed to get distance matrix');
    });
  });

  describe('getDirections', () => {
    it('should get directions successfully', async () => {
      const mockResponse = {
        data: {
          routes: [{
            legs: [{
              distance: { text: '10 km', value: 10000 },
              duration: { text: '20 mins', value: 1200 }
            }]
          }]
        }
      };

      mockClient.directions.mockResolvedValue(mockResponse);

      const result = await GoogleMapsHelper.getDirections('Jakarta', 'Bandung');

      expect(mockClient.directions).toHaveBeenCalledWith({
        params: {
          origin: 'Jakarta',
          destination: 'Bandung',
          key: 'test-api-key'
        }
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should throw error when directions fail', async () => {
      mockClient.directions.mockRejectedValue(new Error('API Error'));

      await expect(GoogleMapsHelper.getDirections('Invalid', 'Invalid'))
        .rejects.toThrow('Failed to get directions');
    });
  });

  describe('searchNearbyParking', () => {
    it('should search nearby parking successfully', async () => {
      const mockResponse = {
        data: {
          results: [{
            name: 'Parking Lot A',
            place_id: 'place123',
            geometry: {
              location: { lat: -6.2088, lng: 106.8456 }
            }
          }]
        }
      };

      mockClient.placesNearby.mockResolvedValue(mockResponse);

      const location = { lat: -6.2088, lng: 106.8456 };
      const result = await GoogleMapsHelper.searchNearbyParking(location);

      expect(mockClient.placesNearby).toHaveBeenCalledWith({
        params: {
          location,
          radius: 5000,
          type: 'parking',
          key: 'test-api-key'
        }
      });
      expect(result).toEqual(mockResponse.data.results);
    });

    it('should search with custom radius', async () => {
      const mockResponse = {
        data: { results: [] }
      };

      mockClient.placesNearby.mockResolvedValue(mockResponse);

      const location = { lat: -6.2088, lng: 106.8456 };
      await GoogleMapsHelper.searchNearbyParking(location, 10000);

      expect(mockClient.placesNearby).toHaveBeenCalledWith({
        params: {
          location,
          radius: 10000,
          type: 'parking',
          key: 'test-api-key'
        }
      });
    });

    it('should throw error when search fails', async () => {
      mockClient.placesNearby.mockRejectedValue(new Error('API Error'));

      const location = { lat: -6.2088, lng: 106.8456 };
      await expect(GoogleMapsHelper.searchNearbyParking(location))
        .rejects.toThrow('Failed to search nearby parking');
    });
  });

  describe('Environment Variable Validation', () => {
    it('should throw error if GOOGLE_MAPS_API_KEY is not set', () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      
      // Re-require the module to trigger the environment check
      jest.resetModules();
      
      expect(() => {
        require('../../../helpers/googleMaps.js');
      }).toThrow('GOOGLE_MAPS_API_KEY environment variable is required');
      
      // Restore for other tests
      process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';
    });
  });
}); 