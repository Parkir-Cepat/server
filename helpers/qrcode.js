import QRCode from "qrcode";
import jwt from "jsonwebtoken";

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
        generatedAt: new Date().toISOString(),
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" } // QR valid 24 jam
    );

    // Generate QR code
    const qrCodeDataURL = await QRCode.toDataURL(qrToken, {
      errorCorrectionLevel: "M",
      type: "image/png",
      quality: 0.92,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      width: 256,
    });

    return qrCodeDataURL;
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error("Gagal membuat QR code");
  }
};

/**
 * Generate Entry QR Token
 * @param {Object} data - Entry data
 * @returns {Promise<string>} QR Token
 */
export const generateEntryQRToken = async (data) => {
  const payload = {
    type: "entry",
    bookingId: data.bookingId,
    parkingId: data.parkingId,
    vehicleType: data.vehicleType,
    expiresAt: data.expiresAt,
    createdAt: new Date().toISOString(),
  };

  return jwt.sign(payload, process.env.JWT_SECRET);
};

/**
 * Generate Exit QR Token
 * @param {Object} data - Exit data
 * @returns {Promise<string>} QR Token
 */
export const generateExitQRToken = async (data) => {
  const payload = {
    type: "exit",
    bookingId: data.bookingId,
    parkingId: data.parkingId,
    vehicleType: data.vehicleType,
    expiresAt: data.expiresAt,
    createdAt: new Date().toISOString(),
  };

  return jwt.sign(payload, process.env.JWT_SECRET);
};

/**
 * Verify QR Token
 * @param {string} token - QR Token
 * @returns {Object} Decoded token
 */
export const verifyQRToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error("QR Code tidak valid atau expired");
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
      parkingLotId: data.parkingLotId,
    };

    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: "H",
      type: "image/png",
      quality: 0.92,
      margin: 1,
      width: 200,
    });

    return qrCodeDataURL;
  } catch (error) {
    console.error("Error generating parking access QR:", error);
    throw new Error("Gagal membuat QR code akses parking");
  }
};
