import { generateGoogleAuthToken, verifyGoogleToken, client } from '../../../helpers/googleAuth.js';
import jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mockedToken'),
  verify: jest.fn((token, secret) => {
    if (token === 'mockedToken') {
      return { id: 'u1', email: 'e@mail.com', role: 'user' };
    }
    throw new Error('jwt must be provided');
  })
}));

jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: jest.fn(async ({ idToken }) => {
        if (!process.env.GOOGLE_CLIENT_ID) {
          throw new Error('GOOGLE_CLIENT_ID is not configured');
        }
        if (idToken === 'token') {
          return {
            getPayload: () => ({ sub: '123', email: 'e@mail.com' })
          };
        } else if (!idToken) {
          throw new Error('Token is required');
        } else if (idToken === 'nullPayloadToken') {
          return {
            getPayload: () => null
          };
        } else {
          throw new Error('Invalid token');
        }
      })
    }))
  };
});

describe('googleAuth helpers', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...OLD_ENV, GOOGLE_CLIENT_ID: 'clientId', JWT_SECRET: 'secret' };
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('generateGoogleAuthToken', () => {
    it('creates a JWT with correct payload', () => {
      const user = { _id: 'u1', email: 'e@mail.com', role: 'user' };
      const token = generateGoogleAuthToken(user);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      expect(decoded.id).toBe('u1'); // Corrected key from _id to id
      expect(decoded.email).toBe('e@mail.com');
      expect(decoded.role).toBe('user');
    });
  });

  describe('verifyGoogleToken', () => {
    it('throws if GOOGLE_CLIENT_ID missing', async () => {
      process.env.GOOGLE_CLIENT_ID = '';
      await expect(verifyGoogleToken('token')).rejects.toThrow('GOOGLE_CLIENT_ID is not configured');
    });

    it('throws if token not provided', async () => {
      await expect(verifyGoogleToken(null)).rejects.toThrow('Token is required');
    });

    it('returns payload on valid token', async () => {
      const fakePayload = { sub: '123', email: 'e@mail.com' };
      const payload = await verifyGoogleToken('token');
      expect(payload).toEqual(fakePayload);
    });

    it('throws when payload is missing', async () => {
      await expect(verifyGoogleToken('nullPayloadToken')).rejects.toThrow('Failed to get payload from Google token');
    });
  });
});
