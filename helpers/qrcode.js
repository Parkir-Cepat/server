import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';

/**
 * Generate QR Code untuk booking
 * @param {Object} bookingData - Data booking
 * @returns {Promise<string>} QR Code sebagai base64 string
 */
export const generateBookingQR = async (bookingData) => {
  try {
    // Buat token JWT untuk security dan verification
    const qrToken = jwt.sign(
      {
        bookingId: bookingData._id,
        userId: bookingData.userId,
        parkingLotId: bookingData.parkingLotId,
        startTime: bookingData.startTime,
        vehicleType: bookingData.vehicleType,
        status: bookingData.status,
        generatedAt: new Date().toISOString()
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' } // QR valid 24 jam
    );

    // Generate QR code
    const qrCodeDataURL = await QRCode.toDataURL(qrToken, {
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

    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Gagal membuat QR code');
  }
};

/**
 * Verify QR Code token
 * @param {string} qrToken - Token dari QR code
 * @returns {Object} Decoded booking data
 */
export const verifyQRToken = (qrToken) => {
  try {
    const decoded = jwt.verify(qrToken, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('QR Code sudah expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('QR Code tidak valid');
    }
    throw new Error('Gagal memverifikasi QR Code');
  }
};

/**
 * Generate QR Code untuk entry/exit parking
 * @param {Object} data - Data untuk entry/exit
 * @returns {Promise<string>} QR Code sebagai base64 string
 */
export const generateParkingAccessQR = async (data) => {
  try {
    const qrData = {
      type: data.type, // 'entry' atau 'exit'
      bookingId: data.bookingId,
      timestamp: new Date().toISOString(),
      parkingLotId: data.parkingLotId
    };

    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 200
    });

    return qrCodeDataURL;
  } catch (error) {
    console.error('Error generating parking access QR:', error);
    throw new Error('Gagal membuat QR code akses parking');
  }
}; 