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
      nameRoom: roomData.nameRoom
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
}
