import { generateGoogleAuthToken } from '../../../helpers/googleAuth.js';
import * as jwtHelper from '../../../helpers/jwt.js';

describe('googleAuth helper', () => {
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
}); 