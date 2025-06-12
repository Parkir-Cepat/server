const { Client } = require('@googlemaps/google-maps-services-js');

if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error('GOOGLE_MAPS_API_KEY environment variable is required');
}

const client = new Client({});

class GoogleMapsHelper {
  static async geocode(address) {
    try {
      const response = await client.geocode({
        params: {
          address,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      });
      return response.data.results[0];
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error('Failed to geocode address');
    }
  }

  static async reverseGeocode(lat, lng) {
    try {
      const response = await client.reverseGeocode({
        params: {
          latlng: { lat, lng },
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      });
      return response.data.results[0];
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      throw new Error('Failed to reverse geocode coordinates');
    }
  }

  static async getDistanceMatrix(origins, destinations) {
    try {
      const response = await client.distancematrix({
        params: {
          origins,
          destinations,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Distance Matrix error:', error);
      throw new Error('Failed to get distance matrix');
    }
  }

  static async getDirections(origin, destination) {
    try {
      const response = await client.directions({
        params: {
          origin,
          destination,
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Directions error:', error);
      throw new Error('Failed to get directions');
    }
  }

  static async searchNearbyParking(location, radius = 5000) {
    try {
      const response = await client.placesNearby({
        params: {
          location,
          radius,
          type: 'parking',
          key: process.env.GOOGLE_MAPS_API_KEY,
        },
      });
      return response.data.results;
    } catch (error) {
      console.error('Places Nearby error:', error);
      throw new Error('Failed to search nearby parking');
    }
  }
}

module.exports = GoogleMapsHelper; 