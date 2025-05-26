import { Model } from 'mongoloquent';

export class ParkingLot extends Model {
  static collectionName = 'parking_lots';
  
  // Define schema fields and their types
  static schema = {
    name: { type: 'string', required: true },
    address: { type: 'string', required: true },
    location: {
      type: 'object',
      properties: {
        type: { type: 'string', default: 'Point' },
        coordinates: { type: 'array' } // [longitude, latitude]
      },
      required: true
    },
    ownerId: { type: 'objectId', ref: 'users', required: true },
    capacity: {
      car: { type: 'number', default: 0 },
      motorcycle: { type: 'number', default: 0 }
    },
    available: {
      car: { type: 'number', default: 0 },
      motorcycle: { type: 'number', default: 0 }
    },
    rates: {
      car: { type: 'number', required: true },
      motorcycle: { type: 'number', required: true }
    },
    operationalHours: {
      open: { type: 'string', required: true }, // format: "HH:mm"
      close: { type: 'string', required: true } // format: "HH:mm"
    },
    facilities: [{ type: 'string' }], // ['cctv', 'roofed', 'security', etc]
    images: [{ type: 'string' }], // URLs to parking lot images
    status: { type: 'string', enum: ['active', 'inactive'], default: 'active' },
    rating: { type: 'number', default: 0 },
    reviewCount: { type: 'number', default: 0 },
    createdAt: { type: 'date', default: Date.now },
    updatedAt: { type: 'date', default: Date.now }
  };

  // Create geospatial index
  static async createIndexes() {
    await this.collection.createIndex({ location: '2dsphere' });
  }

  // Find nearby parking lots
  static async findNearby({ longitude, latitude, maxDistance = 5000, vehicleType }) {
    const query = {
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: maxDistance // in meters
        }
      },
      status: 'active'
    };

    // Add vehicle type availability check if specified
    if (vehicleType) {
      query['available.' + vehicleType] = { $gt: 0 };
    }

    return await this.find(query);
  }

  // Update availability
  static async updateAvailability(parkingLotId, vehicleType, change) {
    const updateQuery = {};
    updateQuery['available.' + vehicleType] = change;

    return await this.findByIdAndUpdate(
      parkingLotId,
      { $inc: updateQuery },
      { new: true }
    );
  }

  // Update rating
  static async updateRating(parkingLotId, newRating) {
    const parkingLot = await this.findById(parkingLotId);
    const newAvgRating = (
      (parkingLot.rating * parkingLot.reviewCount + newRating) / 
      (parkingLot.reviewCount + 1)
    ).toFixed(1);

    return await this.findByIdAndUpdate(
      parkingLotId,
      { 
        $set: { rating: parseFloat(newAvgRating) },
        $inc: { reviewCount: 1 }
      },
      { new: true }
    );
  }
} 