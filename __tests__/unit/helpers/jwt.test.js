import jwt from 'jsonwebtoken';
import { generateToken, verifyToken, ensureAuth, ensureRole } from '../../../helpers/jwt.js';
import { User } from '../../../models/User.js';

// Mock User model
jest.mock('../../../models/User.js');

describe('JWT Helper Functions', () => {
  const mockUser = {
    _id: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    role: 'customer'
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_EXPIRES_IN = '7d';
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const token = generateToken(mockUser);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      
      // Verify token structure
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.id).toBe(mockUser._id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
    });

    it('should include expiration time', () => {
      const token = generateToken(mockUser);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should use default expiration if JWT_EXPIRES_IN not set', () => {
      delete process.env.JWT_EXPIRES_IN;
      const token = generateToken(mockUser);
      
      expect(token).toBeDefined();
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.exp).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token successfully', async () => {
      const token = generateToken(mockUser);
      const decoded = await verifyToken(token);
      
      expect(decoded.id).toBe(mockUser._id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
    });

    it('should throw error for invalid token', async () => {
      const invalidToken = 'invalid.token.here';
      
      await expect(verifyToken(invalidToken)).rejects.toThrow('Token tidak valid');
    });

    it('should throw error for expired token', async () => {
      const expiredToken = jwt.sign(
        { id: mockUser._id },
        process.env.JWT_SECRET,
        { expiresIn: '-1s' }
      );
      
      await expect(verifyToken(expiredToken)).rejects.toThrow('Token tidak valid');
    });

    it('should throw error for token with wrong secret', async () => {
      const tokenWithWrongSecret = jwt.sign(
        { id: mockUser._id },
        'wrong-secret',
        { expiresIn: '1h' }
      );
      
      await expect(verifyToken(tokenWithWrongSecret)).rejects.toThrow('Token tidak valid');
    });
  });

  describe('ensureAuth', () => {
    it('should return user if authenticated', () => {
      const result = ensureAuth(mockUser);
      expect(result).toBe(mockUser);
    });

    it('should throw error if user is null', () => {
      expect(() => ensureAuth(null)).toThrow('Anda harus login terlebih dahulu');
    });

    it('should throw error if user is undefined', () => {
      expect(() => ensureAuth(undefined)).toThrow('Anda harus login terlebih dahulu');
    });
  });

  describe('ensureRole', () => {
    it('should return user if role matches (single role)', () => {
      const result = ensureRole(mockUser, 'customer');
      expect(result).toBe(mockUser);
    });

    it('should return user if role matches (multiple roles)', () => {
      const result = ensureRole(mockUser, ['customer', 'admin']);
      expect(result).toBe(mockUser);
    });

    it('should throw error if role does not match', () => {
      expect(() => ensureRole(mockUser, 'admin')).toThrow('Anda tidak memiliki akses');
    });

    it('should throw error if user is not authenticated', () => {
      expect(() => ensureRole(null, 'customer')).toThrow('Anda harus login terlebih dahulu');
    });

    it('should handle admin role', () => {
      const adminUser = { ...mockUser, role: 'admin' };
      const result = ensureRole(adminUser, 'admin');
      expect(result).toBe(adminUser);
    });

    it('should handle owner role', () => {
      const ownerUser = { ...mockUser, role: 'owner' };
      const result = ensureRole(ownerUser, ['owner', 'admin']);
      expect(result).toBe(ownerUser);
    });
  });
}); 