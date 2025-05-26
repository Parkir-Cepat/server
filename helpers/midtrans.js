import midtransClient from 'midtrans-client';

// Inisialisasi Snap client
const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.MIDTRANS_CLIENT_KEY
});

/**
 * Generate token untuk transaksi Midtrans
 * @param {Object} params - Parameter transaksi
 * @param {string} params.transactionId - ID transaksi
 * @param {number} params.amount - Jumlah pembayaran
 * @param {string} params.customerName - Nama customer
 * @param {string} params.customerEmail - Email customer
 * @returns {Promise<Object>} Token dan redirect URL
 */
export const createTransaction = async ({
  transactionId,
  amount,
  customerName,
  customerEmail
}) => {
  try {
    const parameter = {
      transaction_details: {
        order_id: transactionId,
        gross_amount: amount
      },
      credit_card: {
        secure: true
      },
      customer_details: {
        first_name: customerName,
        email: customerEmail
      }
    };

    const transaction = await snap.createTransaction(parameter);
    return {
      token: transaction.token,
      redirectUrl: transaction.redirect_url
    };
  } catch (error) {
    console.error('❌ Midtrans error:', error);
    throw new Error('Gagal membuat transaksi');
  }
};

/**
 * Verifikasi notifikasi webhook dari Midtrans
 * @param {Object} notification - Data notifikasi dari Midtrans
 * @returns {Promise<Object>} Status transaksi yang diverifikasi
 */
export const verifyNotification = async (notification) => {
  try {
    const statusResponse = await snap.transaction.notification(notification);
    const orderId = statusResponse.order_id;
    const transactionStatus = statusResponse.transaction_status;
    const fraudStatus = statusResponse.fraud_status;

    let status;
    if (transactionStatus === 'capture') {
      if (fraudStatus === 'challenge') {
        status = 'challenge';
      } else if (fraudStatus === 'accept') {
        status = 'success';
      }
    } else if (transactionStatus === 'settlement') {
      status = 'success';
    } else if (transactionStatus === 'cancel' ||
               transactionStatus === 'deny' ||
               transactionStatus === 'expire') {
      status = 'failed';
    } else if (transactionStatus === 'pending') {
      status = 'pending';
    }

    return {
      orderId,
      status
    };
  } catch (error) {
    console.error('❌ Midtrans notification error:', error);
    throw new Error('Gagal memverifikasi notifikasi');
  }
};

/**
 * Cek status transaksi di Midtrans
 * @param {string} transactionId - ID transaksi
 * @returns {Promise<Object>} Status transaksi
 */
export const checkTransactionStatus = async (transactionId) => {
  try {
    const statusResponse = await snap.transaction.status(transactionId);
    return {
      orderId: statusResponse.order_id,
      status: statusResponse.transaction_status,
      fraudStatus: statusResponse.fraud_status
    };
  } catch (error) {
    console.error('❌ Midtrans status check error:', error);
    throw new Error('Gagal mengecek status transaksi');
  }
}; 