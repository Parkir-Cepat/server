import { Model } from 'mongoloquent';

export class Booking extends Model {
  static collectionName = 'bookings';
  
  static schema = {
    userId: { type: 'objectId', ref: 'users', required: true },
    parkingId: { type: 'objectId', ref: 'parkings', required: true },
    startTime: { type: 'date', required: true },
    duration: { type: 'number', required: true }, // in hours
    cost: { type: 'number', required: true },
    status: { 
      type: 'string',
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending'
    },
    createdAt: { type: 'date', default: Date.now }
  };

  // Create indexes
  static async createIndexes() {
    await this.collection.createIndex({ userId: 1 });
    await this.collection.createIndex({ parkingId: 1 });
    await this.collection.createIndex({ createdAt: 1 });
  }

  // Static methods
  static async createBooking(bookingData) {
    const { userId, parkingId, startTime, duration } = bookingData;
    
    // Get parking details
    const parking = await this.model('Parking').findById(parkingId);
    if (!parking) throw new Error('Tempat parkir tidak ditemukan');
    
    // Check availability
    if (parking.availableSlots <= 0) {
      throw new Error('Slot parkir tidak tersedia');
    }

    // Calculate total cost
    const cost = parking.tariff * duration;

    // Create booking
    const booking = await this.create({
      userId,
      parkingId,
      startTime,
      duration,
      cost,
      status: 'pending'
    });

    // Update parking availability
    await this.model('Parking').updateAvailability(parkingId, -1);

    return booking;
  }

  // Confirm booking
  static async confirmBooking(bookingId) {
    const booking = await this.findById(bookingId);
    if (!booking) throw new Error('Booking tidak ditemukan');

    if (booking.status !== 'pending') {
      throw new Error('Booking tidak dapat dikonfirmasi');
    }

    return await this.findByIdAndUpdate(
      bookingId,
      { status: 'confirmed' },
      { new: true }
    );
  }

  // Cancel booking
  static async cancelBooking(bookingId) {
    const booking = await this.findById(bookingId);
    if (!booking) throw new Error('Booking tidak ditemukan');

    if (booking.status !== 'pending') {
      throw new Error('Booking tidak dapat dibatalkan');
    }

    // Update parking availability
    await this.model('Parking').updateAvailability(booking.parkingId, 1);

    return await this.findByIdAndUpdate(
      bookingId,
      { status: 'cancelled' },
      { new: true }
    );
  }

  // Get user's active bookings
  static async getActiveBookings(userId) {
    return await this.find({
      userId,
      status: { $in: ['pending', 'confirmed'] }
    }).populate('parkingId');
  }

  // Get user's booking history
  static async getBookingHistory(userId) {
    return await this.find({
      userId,
      status: 'cancelled'
    }).populate('parkingId');
  }

  // Get associated payment
  async getPayment() {
    return await this.model('Payment').findOne({ bookingId: this._id });
  }
} 