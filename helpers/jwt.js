import jwt from "jsonwebtoken";
import { User } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Generate JWT token untuk user
 * @param {Object} user - User document
 * @returns {string} JWT token
 */
export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Verifikasi JWT token
 * @param {string} token - JWT token
 * @returns {Promise<Object>} Decoded token payload
 */
export const verifyToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Token tidak valid');
  }
};

/**
 * Middleware untuk autentikasi GraphQL context
 * @param {Object} param - Parameter context
 * @param {Object} param.req - HTTP request object
 * @param {Object} param.connection - WebSocket connection object
 * @returns {Promise<Object>} Context object dengan user data
 */
export const authContext = async ({ req, connection }) => {
  // Handle WebSocket connection
  if (connection) {
    const token = connection.context?.authorization?.split(' ')[1] || '';
    if (!token) return { user: null };

    try {
      const decoded = await verifyToken(token);
      const user = await User.findById(decoded.id);
      return { user };
    } catch (error) {
      return { user: null };
    }
  }

  // Handle HTTP request
  const token = req.headers.authorization?.split(' ')[1] || '';
  if (!token) return { user: null };

  try {
    const decoded = await verifyToken(token);
    const user = await User.findById(decoded.id);
    return { user };
  } catch (error) {
    return { user: null };
  }
};

/**
 * Middleware untuk memastikan user terautentikasi
 * @param {Object} user - User data dari context
 * @throws {Error} Jika user tidak terautentikasi
 */
export const ensureAuth = (user) => {
  if (!user) {
    throw new Error('Anda harus login terlebih dahulu');
  }
  return user;
};

/**
 * Middleware untuk memastikan user memiliki role tertentu
 * @param {Object} user - User data dari context
 * @param {string|string[]} roles - Role yang diizinkan
 * @throws {Error} Jika user tidak memiliki role yang sesuai
 */
export const ensureRole = (user, roles) => {
  ensureAuth(user);

  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  if (!allowedRoles.includes(user.role)) {
    throw new Error('Anda tidak memiliki akses');
  }
  return user;
};
