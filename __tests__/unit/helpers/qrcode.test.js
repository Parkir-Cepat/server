import { generateBookingQR, verifyQRToken, generateParkingAccessQR } from '../../../helpers/qrcode.js';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('qrcode');
jest.mock('jsonwebtoken');

describe('QR Code Helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  describe('generateBookingQR', () => {
    it('should generate QR code for booking successfully', async () => {
      const mockBookingData = {
        _id: 'booking123',
        userId: 'user123',
        parkingLotId: 'parking123',
        startTime: new Date('2024-01-01T10:00:00Z'),
        vehicleType: 'car',
        status: 'active'
      };

      const mockToken = 'mock-jwt-token';
      const mockQRDataURL = 'data:image/png;base64,mockqrcode';

      jwt.sign.mockReturnValue(mockToken);
      QRCode.toDataURL.mockResolvedValue(mockQRDataURL);

      const result = await generateBookingQR(mockBookingData);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: mockBookingData._id,
          userId: mockBookingData.userId,
          parkingLotId: mockBookingData.parkingLotId,
          startTime: mockBookingData.startTime,
          vehicleType: mockBookingData.vehicleType,
          status: mockBookingData.status,
          generatedAt: expect.any(String)
        }),
        'test-jwt-secret',
        { expiresIn: '24h' }
      );

      expect(QRCode.toDataURL).toHaveBeenCalledWith(mockToken, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      expect(result).toBe(mockQRDataURL);
    });

    it('should throw error when JWT signing fails', async () => {
      const mockBookingData = {
        _id: 'booking123',
        userId: 'user123'
      };

      jwt.sign.mockImplementation(() => {
        throw new Error('JWT Error');
      });

      await expect(generateBookingQR(mockBookingData))
        .rejects.toThrow('Gagal membuat QR code');
    });

    it('should throw error when QR code generation fails', async () => {
      const mockBookingData = {
        _id: 'booking123',
        userId: 'user123'
      };

      jwt.sign.mockReturnValue('mock-token');
      QRCode.toDataURL.mockRejectedValue(new Error('QR Error'));

      await expect(generateBookingQR(mockBookingData))
        .rejects.toThrow('Gagal membuat QR code');
    });

    it('should include all required booking data in JWT', async () => {
      const mockBookingData = {
        _id: 'booking123',
        userId: 'user123',
        parkingLotId: 'parking123',
        startTime: new Date('2024-01-01T10:00:00Z'),
        vehicleType: 'motorcycle',
        status: 'confirmed'
      };

      jwt.sign.mockReturnValue('mock-token');
      QRCode.toDataURL.mockResolvedValue('mock-qr');

      await generateBookingQR(mockBookingData);

      const jwtPayload = jwt.sign.mock.calls[0][0];
      expect(jwtPayload).toMatchObject({
        bookingId: 'booking123',
        userId: 'user123',
        parkingLotId: 'parking123',
        vehicleType: 'motorcycle',
        status: 'confirmed'
      });
      expect(jwtPayload.generatedAt).toBeDefined();
    });
  });

  describe('verifyQRToken', () => {
    it('should verify QR token successfully', () => {
      const mockToken = 'valid-token';
      const mockDecoded = {
        bookingId: 'booking123',
        userId: 'user123',
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      jwt.verify.mockReturnValue(mockDecoded);

      const result = verifyQRToken(mockToken);

      expect(jwt.verify).toHaveBeenCalledWith(mockToken, 'test-jwt-secret');
      expect(result).toEqual(mockDecoded);
    });

    it('should throw error for expired token', () => {
      const mockToken = 'expired-token';
      const expiredError = new Error('Token expired');
      expiredError.name = 'TokenExpiredError';

      jwt.verify.mockImplementation(() => {
        throw expiredError;
      });

      expect(() => verifyQRToken(mockToken))
        .toThrow('QR Code sudah expired');
    });

    it('should throw error for invalid token', () => {
      const mockToken = 'invalid-token';
      const invalidError = new Error('Invalid token');
      invalidError.name = 'JsonWebTokenError';

      jwt.verify.mockImplementation(() => {
        throw invalidError;
      });

      expect(() => verifyQRToken(mockToken))
        .toThrow('QR Code tidak valid');
    });

    it('should throw generic error for other JWT errors', () => {
      const mockToken = 'problematic-token';
      const genericError = new Error('Some other error');
      genericError.name = 'SomeOtherError';

      jwt.verify.mockImplementation(() => {
        throw genericError;
      });

      expect(() => verifyQRToken(mockToken))
        .toThrow('Gagal memverifikasi QR Code');
    });

    it('should handle null or undefined token', () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('Token required');
      });

      expect(() => verifyQRToken(null))
        .toThrow('Gagal memverifikasi QR Code');

      expect(() => verifyQRToken(undefined))
        .toThrow('Gagal memverifikasi QR Code');
    });
  });

  describe('generateParkingAccessQR', () => {
    it('should generate parking access QR for entry', async () => {
      const mockData = {
        type: 'entry',
        bookingId: 'booking123',
        parkingLotId: 'parking123'
      };

      const mockQRDataURL = 'data:image/png;base64,mockentryqr';
      QRCode.toDataURL.mockResolvedValue(mockQRDataURL);

      const result = await generateParkingAccessQR(mockData);

      expect(QRCode.toDataURL).toHaveBeenCalledWith(
        expect.stringContaining('"type":"entry"'),
        {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          quality: 0.92,
          margin: 1,
          width: 200
        }
      );

      expect(result).toBe(mockQRDataURL);
    });

    it('should generate parking access QR for exit', async () => {
      const mockData = {
        type: 'exit',
        bookingId: 'booking123',
        parkingLotId: 'parking123'
      };

      const mockQRDataURL = 'data:image/png;base64,mockexitqr';
      QRCode.toDataURL.mockResolvedValue(mockQRDataURL);

      const result = await generateParkingAccessQR(mockData);

      const qrDataString = QRCode.toDataURL.mock.calls[0][0];
      const qrData = JSON.parse(qrDataString);

      expect(qrData).toMatchObject({
        type: 'exit',
        bookingId: 'booking123',
        parkingLotId: 'parking123'
      });
      expect(qrData.timestamp).toBeDefined();
      expect(result).toBe(mockQRDataURL);
    });

    it('should include timestamp in parking access QR', async () => {
      const mockData = {
        type: 'entry',
        bookingId: 'booking123',
        parkingLotId: 'parking123'
      };

      QRCode.toDataURL.mockResolvedValue('mock-qr');

      await generateParkingAccessQR(mockData);

      const qrDataString = QRCode.toDataURL.mock.calls[0][0];
      const qrData = JSON.parse(qrDataString);

      expect(qrData.timestamp).toBeDefined();
      expect(new Date(qrData.timestamp)).toBeInstanceOf(Date);
    });

    it('should throw error when QR generation fails', async () => {
      const mockData = {
        type: 'entry',
        bookingId: 'booking123'
      };

      QRCode.toDataURL.mockRejectedValue(new Error('QR Generation Error'));

      await expect(generateParkingAccessQR(mockData))
        .rejects.toThrow('Gagal membuat QR code akses parking');
    });

    it('should handle missing data fields gracefully', async () => {
      const mockData = {
        type: 'entry'
        // Missing bookingId and parkingLotId
      };

      QRCode.toDataURL.mockResolvedValue('mock-qr');

      await generateParkingAccessQR(mockData);

      const qrDataString = QRCode.toDataURL.mock.calls[0][0];
      const qrData = JSON.parse(qrDataString);

      expect(qrData.type).toBe('entry');
      expect(qrData.bookingId).toBeUndefined();
      expect(qrData.parkingLotId).toBeUndefined();
      expect(qrData.timestamp).toBeDefined();
    });
  });

  describe('Environment Variables', () => {
    it('should use JWT_SECRET from environment', async () => {
      process.env.JWT_SECRET = 'custom-secret';

      const mockBookingData = {
        _id: 'booking123',
        userId: 'user123'
      };

      jwt.sign.mockReturnValue('mock-token');
      QRCode.toDataURL.mockResolvedValue('mock-qr');

      await generateBookingQR(mockBookingData);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        'custom-secret',
        expect.any(Object)
      );
    });
  });
}); 