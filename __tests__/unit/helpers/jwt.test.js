import jwt from 'jsonwebtoken';
import { generateToken, verifyToken, ensureAuth, ensureRole, authContext } from '../../../helpers/jwt.js';
import { User } from '../../../models/User.js';
import { ObjectId } from 'mongodb';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../../models/User.js');

describe('JWT Helper', () => {
  const mockUser = {
    _id: new ObjectId(),
    email: 'test@example.com',
    role: 'user'
  };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '7d';
    jest.clearAllMocks();
  });

  describe('Token Generation', () => {
    it('should generate token with correct payload', () => {
      const mockToken = 'mock-token';
      jwt.sign.mockReturnValue(mockToken);

      const token = generateToken(mockUser);

      expect(token).toBe(mockToken);
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: mockUser._id,
          email: mockUser.email,
          role: mockUser.role
        },
        'test-secret',
        { expiresIn: '7d' }
      );
    });

    it('should use default expiration if not set in env', () => {
      delete process.env.JWT_EXPIRES_IN;
      const mockToken = 'mock-token';
      jwt.sign.mockReturnValue(mockToken);

      generateToken(mockUser);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        'test-secret',
        { expiresIn: '7d' }
      );
    });
  });

  describe('Token Verification', () => {
    it('should verify valid token', async () => {
      const mockDecoded = {
        id: mockUser._id,
        email: mockUser.email,
        role: mockUser.role
      };
      jwt.verify.mockReturnValue(mockDecoded);

      const result = await verifyToken('valid-token');

      expect(result).toEqual(mockDecoded);
      expect(jwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    });

    it('should throw error for invalid token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(verifyToken('invalid-token'))
        .rejects
        .toThrow('Token tidak valid');
    });
  });

  describe('Auth Context', () => {
    const mockToken = 'valid-token';
    const mockDecoded = {
      id: mockUser._id,
      email: mockUser.email,
      role: mockUser.role
    };

    beforeEach(() => {
      jwt.verify.mockReturnValue(mockDecoded);
      User.findById.mockResolvedValue(mockUser);
    });

    describe('HTTP Request', () => {
      it('should return user for valid token', async () => {
        const req = {
          headers: {
            authorization: `Bearer ${mockToken}`
          }
        };

        const context = await authContext({ req });

        expect(context.user).toEqual(mockUser);
        expect(User.findById).toHaveBeenCalledWith(mockUser._id);
      });

      it('should return null for missing token', async () => {
        const req = { headers: {} };
        const context = await authContext({ req });

        expect(context.user).toBeNull();
      });

      it('should return null for invalid token', async () => {
        const req = {
          headers: {
            authorization: 'Bearer invalid-token'
          }
        };

        jwt.verify.mockImplementation(() => {
          throw new Error('Invalid token');
        });

        const context = await authContext({ req });

        expect(context.user).toBeNull();
      });
    });

    describe('WebSocket Connection', () => {
      it('should return user for valid token', async () => {
        const connection = {
          context: {
            authorization: `Bearer ${mockToken}`
          }
        };

        const context = await authContext({ connection });

        expect(context.user).toEqual(mockUser);
      });

      it('should return null for missing token', async () => {
        const connection = { context: {} };
        const context = await authContext({ connection });

        expect(context.user).toBeNull();
      });
    });
  });

  describe('Auth Middleware', () => {
    describe('ensureAuth', () => {
      it('should return user if authenticated', () => {
        const result = ensureAuth(mockUser);
        expect(result).toBe(mockUser);
      });

      it('should throw error if not authenticated', () => {
        expect(() => ensureAuth(null))
          .toThrow('Anda harus login terlebih dahulu');
      });
    });

    describe('ensureRole', () => {
      it('should return user if has correct role', () => {
        const result = ensureRole(mockUser, 'user');
        expect(result).toBe(mockUser);
      });

      it('should accept array of roles', () => {
        const result = ensureRole(mockUser, ['admin', 'user']);
        expect(result).toBe(mockUser);
      });

      it('should throw error if wrong role', () => {
        expect(() => ensureRole(mockUser, 'admin'))
          .toThrow('Anda tidak memiliki akses');
      });

      it('should throw error if not authenticated', () => {
        expect(() => ensureRole(null, 'user'))
          .toThrow('Anda harus login terlebih dahulu');
      });
    });
  });
}); 