import { generateBookingQR, generateEntryQRToken, generateExitQRToken, verifyQRToken, generateParkingAccessQR } from '../../../helpers/qrcode.js';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';

describe('qrcode helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'secret';
  });

  it('generateBookingQR throws on QRCode error', async () => {
    jest.spyOn(QRCode, 'toDataURL').mockRejectedValue(new Error('err'));  
    await expect(generateBookingQR({ _id:'b', userId:'u', parkingLotId:'p', startTime: Date.now(), vehicleType:'car', status:'active' }))
      .rejects.toThrow('Gagal membuat QR code');
  });

  it('generateEntryQRToken returns token with type entry', async () => {
    const token = await generateEntryQRToken({ bookingId: 'b', parkingId: 'p', vehicleType: 'car', expiresAt: 'e' });
    expect(typeof token).toBe('string');
    const data = jwt.verify(token, 'secret');
    expect(data.type).toBe('entry');
  });

  it('verifyQRToken throws on invalid token', () => {
    expect(() => verifyQRToken('bad')).toThrow('QR Code tidak valid atau expired');
  });

  it('generateParkingAccessQR returns QR on success', async () => {
    jest.spyOn(QRCode, 'toDataURL').mockResolvedValue('data');
    const res = await generateParkingAccessQR({ type:'entry', bookingId:'b', parkingLotId:'p' });
    expect(res).toBe('data');
  });
});
