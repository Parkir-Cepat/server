import { Model } from 'mongoloquent';

export class Chat extends Model {
  static collectionName = 'chats';
  
  static schema = {
    senderId: { type: 'objectId', ref: 'users', required: true },
    receiverId: { type: 'objectId', ref: 'users', required: true },
    bookingId: { type: 'objectId', ref: 'bookings' }, // Optional, for context
    message: { type: 'string', required: true },
    createdAt: { type: 'date', default: Date.now }
  };

  // Create indexes
  static async createIndexes() {
    // Compound index for chat history between users
    await this.collection.createIndex({ 
      senderId: 1, 
      receiverId: 1, 
      createdAt: 1 
    });
    await this.collection.createIndex({ bookingId: 1 });
  }

  // Send message
  static async sendMessage(senderId, receiverId, message, bookingId = null) {
    // Validate users exist
    const [sender, receiver] = await Promise.all([
      this.model('User').findById(senderId),
      this.model('User').findById(receiverId)
    ]);

    if (!sender || !receiver) {
      throw new Error('Pengirim atau penerima tidak ditemukan');
    }

    // Create chat message
    return await this.create({
      senderId,
      receiverId,
      message,
      bookingId
    });
  }

  // Get chat history between two users
  static async getChatHistory(userId1, userId2, limit = 50) {
    return await this.find({
      $or: [
        { senderId: userId1, receiverId: userId2 },
        { senderId: userId2, receiverId: userId1 }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('senderId', 'name')
    .populate('receiverId', 'name');
  }

  // Get chat messages for a booking
  static async getBookingChats(bookingId) {
    return await this.find({ bookingId })
      .sort({ createdAt: 1 })
      .populate('senderId', 'name')
      .populate('receiverId', 'name');
  }

  // Get recent chat conversations for a user
  static async getRecentChats(userId) {
    const chats = await this.aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { receiverId: userId }]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$senderId', userId] },
              '$receiverId',
              '$senderId'
            ]
          },
          lastMessage: { $first: '$message' },
          lastMessageTime: { $first: '$createdAt' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'otherUser'
        }
      },
      {
        $unwind: '$otherUser'
      },
      {
        $project: {
          otherUser: {
            _id: 1,
            name: 1
          },
          lastMessage: 1,
          lastMessageTime: 1
        }
      },
      {
        $sort: { lastMessageTime: -1 }
      }
    ]);

    return chats;
  }
} 