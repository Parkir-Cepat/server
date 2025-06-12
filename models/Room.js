import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

export class Room {
  static collection = "rooms";

  /**
   * Setup indexes untuk collection
   */
  static async setupIndexes() {
    const db = getDB();
    await Promise.all([
      db.collection(this.collection).createIndex({ nameRoom: 1 })
    ]);
  }

  /**
   * Mencari room berdasarkan ID
   * @param {string} id - ID room
   * @returns {Promise<Object>} Room document
   */
  static async findById(id) {
    const db = getDB();
    return await db.collection(this.collection).findOne({ _id: new ObjectId(id) });
  }

  /**
   * Membuat room baru
   * @param {Object} roomData - Data room
   * @returns {Promise<Object>} Room document yang baru dibuat
   */
  static async create(roomData) {
    const db = getDB();
    const room = {
      nameRoom: roomData.nameRoom,
      type: roomData.type || 'general',
      privacy: roomData.privacy || 'public',
      creator_id: roomData.creator_id,
      max_participants: roomData.max_participants || null,
      parking_id: roomData.parking_id || null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await db.collection(this.collection).insertOne(room);
    return { _id: result.insertedId, ...room };
  }

  /**
   * Mendapatkan semua room
   * @returns {Promise<Array>} Array of room documents
   */
  static async findAll() {
    const db = getDB();
    return await db.collection(this.collection).find({}).toArray();
  }

  static async update(id, updateData) {
    const db = getDB();
    const result = await db.collection(this.collection).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: {
          ...updateData,
          updated_at: new Date()
        }
      },
      { returnDocument: "after" }
    );
    return result;
  }

  static async delete(id) {
    const db = getDB();
    const result = await db.collection(this.collection).deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  }

  /**
   * Find multiple rooms by their IDs
   * @param {Array<string>} ids - Array of room IDs
   * @returns {Promise<Array>} Array of room documents
   */
  static async findByIds(ids) {
    const db = getDB();
    const objectIds = ids.map(id => new ObjectId(id));
    return await db.collection(this.collection)
      .find({ _id: { $in: objectIds } })
      .toArray();
  }

  // Setup indexes
  static async setupIndexes() {
    const db = getDB();
    await Promise.all([
      db.collection(this.collection).createIndex({ nameRoom: 1 }),
      db.collection(this.collection).createIndex({ created_at: 1 })
    ]);
  }

  /**
   * Mencari room public yang tersedia
   * @param {number} limit - Limit hasil
   * @param {string} parking_id - Filter berdasarkan parking (optional)
   * @returns {Promise<Array>} Array of public room documents
   */
  static async findPublicRooms(limit = 10, parking_id = null) {
    const db = getDB();
    const filter = { privacy: 'public' };
    if (parking_id) {
      filter.parking_id = parking_id;
    }
    return await db.collection(this.collection)
      .find(filter)
      .limit(limit)
      .sort({ created_at: -1 })
      .toArray();
  }

  /**
   * Mencari room private antara 2 user
   * @param {string} user1_id - ID user pertama
   * @param {string} user2_id - ID user kedua
   * @param {string} parking_id - ID parking (optional)
   * @returns {Promise<Object>} Room document atau null
   */
  static async findPrivateRoomBetweenUsers(user1_id, user2_id, parking_id = null) {
    const db = getDB();
    const filter = {
      privacy: 'private',
      type: 'direct'
    };
    if (parking_id) {
      filter.parking_id = parking_id;
    }
    
    // Cari room yang creator atau participant adalah kedua user ini
    const rooms = await db.collection(this.collection).find(filter).toArray();
    
    // Import UserRoom untuk cek participants
    const { UserRoom } = await import('./UserRoom.js');
    
    for (const room of rooms) {
      const participants = await UserRoom.findByRoomId(room._id);
      const participantIds = participants.map(p => p.user_id.toString());
      
      if (participantIds.includes(user1_id) && participantIds.includes(user2_id)) {
        return room;
      }
    }
    
    return null;
  }
}
