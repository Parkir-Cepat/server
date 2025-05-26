import { Model } from 'mongoloquent';

export class Payment extends Model {
  static collectionName = 'payments';
  
  static schema = {
    bookingId: { type: 'objectId', ref: 'bookings', required: true },
    transactionId: { type: 'string', required: true, unique: true },
    paymentMethod: { 
      type: 'string',
      enum: ['qris', 'gopay', 'shopeepay', 'saldo'],
      required: true
    },
    amount: { type: 'number', required: true },
    status: { 
      type: 'string',
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    },
    qrCodeUrl: { type: 'string' }, // URL for QRIS code
    createdAt: { type: 'date', default: Date.now },
    updatedAt: { type: 'date', default: Date.now }
  };

  // Create indexes
  static async createIndexes() {
    await this.collection.createIndex({ bookingId: 1 });
    await this.collection.createIndex({ transactionId: 1 }, { unique: true });
    await this.collection.createIndex({ createdAt: 1 });
  }

  // Hooks
  static async beforeSave(next) {
    this.updatedAt = new Date();
    next();
  }

  // Create payment for booking
  static async createPayment(paymentData) {
    const { bookingId, paymentMethod } = paymentData;
    
    // Get booking details
    const booking = await this.model('Booking').findById(bookingId);
    if (!booking) throw new Error('Booking tidak ditemukan');
    
    if (booking.status !== 'pending') {
      throw new Error('Booking tidak dapat dibayar');
    }

    // If using saldo, check and deduct user's saldo
    if (paymentMethod === 'saldo') {
      const user = await this.model('User').findById(booking.userId);
      await user.deductSaldo(booking.cost);
    }

    // Create payment record
    const payment = await this.create({
      ...paymentData,
      amount: booking.cost,
      status: paymentMethod === 'saldo' ? 'completed' : 'pending'
    });

    // If saldo payment, confirm booking immediately
    if (paymentMethod === 'saldo') {
      await this.model('Booking').confirmBooking(bookingId);
    }

    return payment;
  }

  // Update payment status (e.g., from Midtrans webhook)
  static async updatePaymentStatus(transactionId, newStatus) {
    const payment = await this.findOne({ transactionId });
    if (!payment) throw new Error('Pembayaran tidak ditemukan');

    const updatedPayment = await this.findOneAndUpdate(
      { transactionId },
      { 
        status: newStatus,
        updatedAt: new Date()
      },
      { new: true }
    );

    // If payment completed, confirm the booking
    if (newStatus === 'completed') {
      await this.model('Booking').confirmBooking(payment.bookingId);
    }

    return updatedPayment;
  }

  // Get payment by booking
  static async getPaymentByBooking(bookingId) {
    return await this.findOne({ bookingId }).populate('bookingId');
  }
} 