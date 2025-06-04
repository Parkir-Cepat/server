import * as jwtHelper from '../../../helpers/jwt.js';

const mockVerifyIdToken = jest.fn();
const mockOAuth2ClientInstance = { verifyIdToken: mockVerifyIdToken };

jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn(() => mockOAuth2ClientInstance)
  };
});

let generateGoogleAuthToken, verifyGoogleToken;

beforeAll(() => {
  // Import setelah mock aktif
  ({ generateGoogleAuthToken, verifyGoogleToken } = require('../../../helpers/googleAuth.js'));
});

describe('googleAuth helper', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });

  describe('generateGoogleAuthToken', () => {
    it('should generate JWT token with correct payload', () => {
      const user = { _id: 'user123', email: 'test@example.com', role: 'user' };
      const mockToken = 'mock.jwt.token';
      jest.spyOn(jwtHelper, 'generateToken').mockReturnValue(mockToken);
      
      const token = generateGoogleAuthToken(user);
      
      expect(jwtHelper.generateToken).toHaveBeenCalledWith({
        _id: user._id,
        email: user.email,
        role: user.role
      });
      expect(token).toBe(mockToken);
    });
  });
  
  describe('verifyGoogleToken', () => {
    beforeEach(() => {
      mockVerifyIdToken.mockReset();
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({}) });
    });

    it('should throw error if token is not provided', async () => {
      await expect(verifyGoogleToken()).rejects.toThrow('Token is required');
    });

    it('should throw error if verifyIdToken fails', async () => {
      mockVerifyIdToken.mockRejectedValueOnce(new Error('Invalid token'));
      await expect(verifyGoogleToken('invalid-token')).rejects.toThrow('Invalid token');
    });

    it('should throw error if getPayload returns null', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({ getPayload: () => null });
      await expect(verifyGoogleToken('token-without-payload')).rejects.toThrow('Failed to get payload from Google token');
    });

    it('should return payload when token is valid', async () => {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      jest.resetModules();
      const { verifyGoogleToken } = require('../../../helpers/googleAuth.js');
      const mockPayload = {
        sub: '12345',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/photo.jpg'
      };
      mockVerifyIdToken.mockResolvedValueOnce({ getPayload: () => mockPayload });
      const result = await verifyGoogleToken('valid-token');
      expect(mockVerifyIdToken).toHaveBeenCalledWith({
        idToken: 'valid-token',
        audience: 'test-client-id'
      });
      expect(result).toEqual(mockPayload);
    });
  });
});