import { Model } from 'mongoloquent';

export class Parking extends Model {
  static collectionName = 'parkings';
  
  // Define schema fields and their types
  static schema = {
    name: { type: 'string', required: true },
    location: {
      type: 'object',
      properties: {
        type: { type: 'string', default: 'Point' },
        coordinates: { type: 'array' } // [longitude, latitude]
      },
      required: true
    },
    availableSlots: { type: 'number', required: true },
    totalSlots: { type: 'number', required: true },
    tariff: { type: 'number', required: true }, // IDR per hour
    ownerId: { type: 'objectId', ref: 'users', required: true },
    createdAt: { type: 'date', default: Date.now }
  };

  // Create indexes
  static async createIndexes() {
    await this.collection.createIndex({ location: '2dsphere' });
    await this.collection.createIndex({ ownerId: 1 });
    await this.collection.createIndex({ createdAt: 1 });
  }

  // Find nearby parkings
  static async findNearby({ longitude, latitude, maxDistance = 5000 }) {
    return await this.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: maxDistance // in meters
        }
      },
      availableSlots: { $gt: 0 }
    });
  }

  // Update available slots
  static async updateAvailability(parkingId, change) {
    const parking = await this.findById(parkingId);
    if (!parking) throw new Error('Tempat parkir tidak ditemukan');

    const newAvailable = parking.availableSlots + change;
    if (newAvailable < 0 || newAvailable > parking.totalSlots) {
      throw new Error('Slot parkir tidak valid');
    }

    return await this.findByIdAndUpdate(
      parkingId,
      { $inc: { availableSlots: change } },
      { new: true }
    );
  }

  // Get active bookings for this parking
  static async getActiveBookings(parkingId) {
    return await this.model('Booking').find({
      parkingId,
      status: { $in: ['pending', 'confirmed'] }
    }).populate('userId');
  }

  // Get owner details
  async getOwner() {
    return await this.model('User').findById(this.ownerId);
  }
} 