import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

export class Chat {
  static collection = "chats";
  /**
   * Setup indexes untuk collection
   */
  static async setupIndexes() {
    const db = getDB();
    await Promise.all([
      // Compound index untuk chat history antar users
      db.collection(this.collection).createIndex({
        user_id: 1,
        room_id: 1,
        created_at: 1,
      }),
      db.collection(this.collection).createIndex({ room_id: 1 }),
      db.collection(this.collection).createIndex({ created_at: 1 }),
    ]);
  }

  static async sendMessage(senderId, receiverId, message, bookingId = null) {
    const db = getDB();

    // Validasi users exist
    const [sender, receiver] = await Promise.all([
      db.collection("users").findOne({ _id: new ObjectId(senderId) }),
      db.collection("users").findOne({ _id: new ObjectId(receiverId) }),
    ]);

    if (!sender || !receiver) {
      throw new Error("Pengirim atau penerima tidak ditemukan");
    }
    const chat = {
      senderId: new ObjectId(senderId),
      receiverId: new ObjectId(receiverId),
      message,
      bookingId: bookingId ? new ObjectId(bookingId) : null,
      read: false,
      created_at: new Date(),
    };

    const result = await db.collection(this.collection).insertOne(chat);
    return { _id: result.insertedId, ...chat };
  }

  static async markAsRead(messageId) {
    const db = getDB();
    const result = await db
      .collection(this.collection)
      .findOneAndUpdate(
        { _id: new ObjectId(messageId) },
        { $set: { read: true } },
        { returnDocument: "after" }
      );
    return result;
  }
  static async getChatHistory(userId1, userId2, limit = 50) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .find({
        $or: [
          {
            senderId: new ObjectId(userId1),
            receiverId: new ObjectId(userId2),
          },
          {
            senderId: new ObjectId(userId2),
            receiverId: new ObjectId(userId1),
          },
        ],
      })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
  }

  static async getBookingChats(bookingId) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .find({ bookingId: new ObjectId(bookingId) })
      .sort({ createdAt: 1 })
      .toArray();
  }

  static async getRecentChats(userId) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .aggregate([
        {
          $match: {
            $or: [
              { senderId: new ObjectId(userId) },
              { receiverId: new ObjectId(userId) },
            ],
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ["$senderId", new ObjectId(userId)] },
                "$receiverId",
                "$senderId",
              ],
            },
            lastMessage: { $first: "$message" },
            lastMessageTime: { $first: "$createdAt" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "otherUser",
          },
        },
        {
          $unwind: "$otherUser",
        },
        {
          $project: {
            otherUser: {
              _id: 1,
              name: 1,
            },
            lastMessage: 1,
            lastMessageTime: 1,
          },
        },
        {
          $sort: { lastMessageTime: -1 },
        },
      ])
      .toArray();
  }

  static async getUnreadMessages(userId) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .find({
        receiverId: new ObjectId(userId),
        read: false,
      })
      .toArray();
  }

  static async setupIndexes() {
    const db = getDB();
    await Promise.all([
      // Compound index untuk chat history antar users
      db.collection(this.collection).createIndex({
        senderId: 1,
        receiverId: 1,
        createdAt: 1,
      }),
      db.collection(this.collection).createIndex({ bookingId: 1 }),
      db.collection(this.collection).createIndex({ createdAt: 1 }),
      db.collection(this.collection).createIndex({ read: 1 }),
    ]);
  }

  static async createIndexes() {
    return await this.setupIndexes();
  }
  static async create(chatData) {
    const db = getDB();
    const chat = {
      user_id: new ObjectId(chatData.user_id),
      room_id: new ObjectId(chatData.room_id),
      message: chatData.message,
      message_type: chatData.message_type || "text",
      read_by: [],
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await db.collection(this.collection).insertOne(chat);
    return { _id: result.insertedId, ...chat };
  }

  static async getHistory(userId1, userId2, limit = 50) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .find({
        $or: [
          {
            senderId: new ObjectId(userId1),
            receiverId: new ObjectId(userId2),
          },
          {
            senderId: new ObjectId(userId2),
            receiverId: new ObjectId(userId1),
          },
        ],
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  static async getByBooking(bookingId) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .find({ bookingId: new ObjectId(bookingId) })
      .sort({ createdAt: 1 })
      .toArray();
  }

  static async getParticipants(userId) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .aggregate([
        {
          $match: {
            $or: [
              { senderId: new ObjectId(userId) },
              { receiverId: new ObjectId(userId) },
            ],
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ["$senderId", new ObjectId(userId)] },
                "$receiverId",
                "$senderId",
              ],
            },
            lastMessage: { $first: "$message" },
            lastMessageTime: { $first: "$createdAt" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "otherUser",
          },
        },
        {
          $unwind: "$otherUser",
        },
        {
          $project: {
            otherUser: {
              _id: 1,
              name: 1,
            },
            lastMessage: 1,
            lastMessageTime: 1,
          },
        },
        {
          $sort: { lastMessageTime: -1 },
        },
      ])
      .toArray();
  }

  static async getUnread(userId) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .find({
        receiverId: new ObjectId(userId),
        read: false,
      })
      .toArray();
  }

  static async markAllAsRead(senderId, receiverId) {
    const db = getDB();
    return await db.collection(this.collection).updateMany(
      {
        senderId: new ObjectId(senderId),
        receiverId: new ObjectId(receiverId),
        read: false,
      },
      { $set: { read: true } }
    );
  }

  /**
   * Mencari chat berdasarkan ID
   * @param {string} id - ID chat
   * @returns {Promise<Object>} Chat document
   */
  static async findById(id) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .findOne({ _id: new ObjectId(id) });
  }
  /**
   * Mengirim pesan dalam room
   * @param {Object} chatData - Data chat
   * @returns {Promise<Object>} Chat document yang baru dibuat
   */
  static async sendMessage(chatData) {
    const db = getDB();

    // Validasi user dan room exist
    const [user, room] = await Promise.all([
      db.collection("users").findOne({ _id: new ObjectId(chatData.user_id) }),
      db.collection("rooms").findOne({ _id: new ObjectId(chatData.room_id) }),
    ]);

    if (!user || !room) {
      throw new Error("User atau room tidak ditemukan");
    }

    const chat = {
      room_id: new ObjectId(chatData.room_id),
      user_id: new ObjectId(chatData.user_id),
      message: chatData.message,
      message_type: chatData.message_type || "text",
      read_by: [],
      created_at: new Date(),
      updated_at: new Date(),
    };

    const result = await db.collection(this.collection).insertOne(chat);
    return { _id: result.insertedId, ...chat };
  }
  /**
   * Mendapatkan riwayat chat dalam room
   * @param {string} roomId - ID room
   * @param {number} limit - Limit pesan
   * @returns {Promise<Array>} Array of chat documents
   */
  static async getRoomChats(roomId, limit = 50) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .find({ room_id: new ObjectId(roomId) })
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();
  }

  /**
   * Mendapatkan chat berdasarkan user
   * @param {string} userId - ID user
   * @returns {Promise<Array>} Array of chat documents
   */
  static async getUserChats(userId) {
    const db = getDB();
    return await db
      .collection(this.collection)
      .find({ user_id: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();
  }

  /**
   * Mark all messages in a room as read by a specific user
   * @param {string} roomId - ID room
   * @param {string} userId - ID user
   * @returns {Promise<Object>} Update result
   */
  static async markRoomAsRead(roomId, userId) {
    const db = getDB();
    return await db.collection(this.collection).updateMany(
      {
        room_id: new ObjectId(roomId),
        read_by: { $ne: new ObjectId(userId) },
      },
      {
        $addToSet: { read_by: new ObjectId(userId) },
        $set: { updated_at: new Date() },
      }
    );
  }
}
