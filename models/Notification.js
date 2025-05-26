import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

export class Notification {
  static collection = "notifications";

  static async create(notificationData) {
    const db = getDB();
    const notification = {
      ...notificationData,
      userId: new ObjectId(notificationData.userId),
      isRead: false,
      createdAt: new Date()
    };

    const result = await db.collection(this.collection).insertOne(notification);
    return { _id: result.insertedId, ...notification };
  }

  static async findByUserId(userId, limit = 20) {
    const db = getDB();
    return await db.collection(this.collection)
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  static async markAsRead(id, userId) {
    const db = getDB();
    return await db.collection(this.collection).updateOne(
      { 
        _id: new ObjectId(id), 
        userId: new ObjectId(userId) 
      },
      { $set: { isRead: true } }
    );
  }

  static async markAllAsRead(userId) {
    const db = getDB();
    return await db.collection(this.collection).updateMany(
      { userId: new ObjectId(userId) },
      { $set: { isRead: true } }
    );
  }

  static async getUnreadCount(userId) {
    const db = getDB();
    return await db.collection(this.collection).countDocuments({
      userId: new ObjectId(userId),
      isRead: false
    });
  }

  static async setupIndexes() {
    const db = getDB();
    await db.collection(this.collection).createIndex({ userId: 1 });
    await db.collection(this.collection).createIndex({ createdAt: -1 });
    await db.collection(this.collection).createIndex({ isRead: 1 });
  }

  // Helper untuk membuat notifikasi berdasarkan tipe
  static async createBookingNotification(userId, type, booking) {
    const messages = {
      'booking_created': 'Booking berhasil dibuat',
      'booking_confirmed': 'Booking dikonfirmasi oleh pemilik parkir',
      'booking_cancelled': 'Booking dibatalkan',
      'booking_expired': 'Booking sudah expired',
      'payment_success': 'Pembayaran berhasil',
      'payment_failed': 'Pembayaran gagal'
    };

    return await this.create({
      userId,
      type: 'booking',
      title: messages[type] || 'Update Booking',
      message: `${messages[type]} untuk booking ID: ${booking._id}`,
      data: {
        bookingId: booking._id,
        action: type
      }
    });
  }

  static async createPaymentNotification(userId, type, payment) {
    const messages = {
      'topup_success': 'Top-up saldo berhasil',
      'topup_failed': 'Top-up saldo gagal',
      'payment_success': 'Pembayaran booking berhasil',
      'payment_failed': 'Pembayaran booking gagal'
    };

    return await this.create({
      userId,
      type: 'payment',
      title: messages[type] || 'Update Pembayaran',
      message: `${messages[type]} sebesar Rp ${payment.amount?.toLocaleString('id-ID')}`,
      data: {
        paymentId: payment._id,
        amount: payment.amount,
        action: type
      }
    });
  }

  static async createChatNotification(userId, chatMessage) {
    return await this.create({
      userId,
      type: 'chat',
      title: 'Pesan Baru',
      message: `Anda mendapat pesan baru: ${chatMessage.message.substring(0, 50)}...`,
      data: {
        chatId: chatMessage._id,
        bookingId: chatMessage.bookingId,
        senderId: chatMessage.senderId
      }
    });
  }
} 