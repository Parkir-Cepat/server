import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

export class UserRoom {
  static collection = "userRooms";

  /**
   * Setup indexes untuk collection
   */
  static async setupIndexes() {
    const db = getDB();
    await Promise.all([
      db.collection(this.collection).createIndex({ user_id: 1 }),
      db.collection(this.collection).createIndex({ room_id: 1 }),
      db.collection(this.collection).createIndex({ user_id: 1, room_id: 1 }, { unique: true })
    ]);
  }

  /**
   * Mencari user room berdasarkan ID
   * @param {string} id - ID user room
   * @returns {Promise<Object>} UserRoom document
   */
  static async findById(id) {
    const db = getDB();
    return await db.collection(this.collection).findOne({ _id: new ObjectId(id) });
  }

  /**
   * Menambahkan user ke room
   * @param {Object} userRoomData - Data user room
   * @returns {Promise<Object>} UserRoom document yang baru dibuat
   */
  static async create(userRoomData) {
    const db = getDB();
    const userRoom = {
      user_id: new ObjectId(userRoomData.user_id),
      room_id: new ObjectId(userRoomData.room_id),
      created_at: new Date()
    };

    const result = await db.collection(this.collection).insertOne(userRoom);
    return { _id: result.insertedId, ...userRoom };
  }

  /**
   * Mencari room berdasarkan user ID
   * @param {string} userId - ID user
   * @returns {Promise<Array>} Array of user room documents
   */
  static async findByUserId(userId) {
    const db = getDB();
    return await db.collection(this.collection)
      .find({ user_id: new ObjectId(userId) })
      .toArray();
  }

  /**
   * Mencari user berdasarkan room ID
   * @param {string} roomId - ID room
   * @returns {Promise<Array>} Array of user room documents
   */
  static async findByRoomId(roomId) {
    const db = getDB();
    return await db.collection(this.collection)
      .find({ room_id: new ObjectId(roomId) })
      .toArray();
  }

  static async findUserRooms(userId) {
    const db = getDB();
    return await db.collection(this.collection).aggregate([
      {
        $match: { user_id: new ObjectId(userId) }
      },
      {
        $lookup: {
          from: "rooms",
          localField: "room_id",
          foreignField: "_id",
          as: "room"
        }
      },
      {
        $unwind: "$room"
      }
    ]).toArray();
  }

  static async findRoomUsers(roomId) {
    const db = getDB();
    return await db.collection(this.collection).aggregate([
      {
        $match: { room_id: new ObjectId(roomId) }
      },
      {
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "user"
        }
      },
      {
        $unwind: "$user"
      }
    ]).toArray();
  }

  static async delete(userId, roomId) {
    const db = getDB();
    const result = await db.collection(this.collection).deleteOne({
      user_id: new ObjectId(userId),
      room_id: new ObjectId(roomId)
    });
    return result.deletedCount > 0;
  }

  static async isUserInRoom(userId, roomId) {
    const db = getDB();
    const count = await db.collection(this.collection).countDocuments({
      user_id: new ObjectId(userId),
      room_id: new ObjectId(roomId)
    });
    return count > 0;
  }

  /**
   * Count the number of users in a room
   * @param {string} roomId - ID room
   * @returns {Promise<number>} Count of users in the room
   */
  static async countByRoom(roomId) {
    const db = getDB();
    return await db.collection(this.collection).countDocuments({
      room_id: new ObjectId(roomId)
    });
  }

  /**
   * Find a UserRoom by both user and room IDs
   * @param {string} userId - ID user
   * @param {string} roomId - ID room
   * @returns {Promise<Object>} UserRoom document
   */
  static async findByUserAndRoom(userId, roomId) {
    const db = getDB();
    return await db.collection(this.collection).findOne({
      user_id: new ObjectId(userId),
      room_id: new ObjectId(roomId)
    });
  }

  // Setup indexes
  static async setupIndexes() {
    const db = getDB();
    await Promise.all([
      db.collection(this.collection).createIndex({ user_id: 1 }),
      db.collection(this.collection).createIndex({ room_id: 1 }),
      db.collection(this.collection).createIndex({ user_id: 1, room_id: 1 }, { unique: true }),
      db.collection(this.collection).createIndex({ created_at: 1 })
    ]);
  }
}
