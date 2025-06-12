import { hashPassword, comparePassword } from '../../../helpers/bcrypt.js';

describe('Bcrypt Helper Functions', () => {
  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const password = 'testpassword123';
      const hashedPassword = await hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(50);
      expect(hashedPassword).toMatch(/^\$2[aby]\$10\$/);
    });

    it('should throw error for invalid input', async () => {
      await expect(hashPassword(null)).rejects.toThrow('Error hashing password');
      await expect(hashPassword(undefined)).rejects.toThrow('Error hashing password');
    });

    it('should generate different hashes for same password', async () => {
      const password = 'testpassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for correct password', async () => {
      const password = 'testpassword123';
      const hashedPassword = await hashPassword(password);
      
      const isMatch = await comparePassword(password, hashedPassword);
      expect(isMatch).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'testpassword123';
      const wrongPassword = 'wrongpassword';
      const hashedPassword = await hashPassword(password);
      
      const isMatch = await comparePassword(wrongPassword, hashedPassword);
      expect(isMatch).toBe(false);
    });

    it('should throw error for invalid inputs', async () => {
      const password = 'testpassword123';
      const hashedPassword = await hashPassword(password);
      
      await expect(comparePassword(null, hashedPassword)).rejects.toThrow('Error comparing password');
      await expect(comparePassword(password, null)).rejects.toThrow('Error comparing password');
      await expect(comparePassword(undefined, hashedPassword)).rejects.toThrow('Error comparing password');
    });

    it('should handle empty strings', async () => {
      // bcrypt.compare actually returns false for empty strings rather than throwing
      const result = await comparePassword('', '');
      expect(result).toBe(false);
    });
  });
}); 