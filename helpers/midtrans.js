// midtrans.js
import midtransClient from "midtrans-client";
import dotenv from "dotenv";

dotenv.config();

// Snap API (for most payments)
const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true" || false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
});

// Core API (for QRIS and Virtual Account)
const coreApi = new midtransClient.CoreApi({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true" || false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
});

/**
 * Create transaction based on payment type
 */
export const createTransaction = async ({
  transactionId,
  amount,
  customerName,
  customerEmail,
  paymentType = "qris",
}) => {
  try {
    const baseParameter = {
      transaction_details: {
        order_id: transactionId,
        gross_amount: amount,
      },
      customer_details: {
        first_name: customerName,
        last_name: "",
        email: customerEmail,
        phone: "+62812345678",
      },
      item_details: [
        {
          id: "topup_saldo",
          price: amount,
          quantity: 1,
          name: "Top Up Saldo ParkGo",
          category: "digital_goods",
        },
      ],
    };

    // VA Payments via Core API
    if (
      paymentType === "bri_va" ||
      paymentType === "bca_va" ||
      paymentType === "mandiri_va"
    ) {
      const bankCode = paymentType.split("_")[0];

      try {
        const coreParams = {
          payment_type: "bank_transfer",
          transaction_details: baseParameter.transaction_details,
          customer_details: baseParameter.customer_details,
          item_details: baseParameter.item_details,
          bank_transfer: {
            bank: bankCode,
            va_number: baseParameter.customer_details.phone.replace("+62", ""),
          },
        };

        console.log(`Attempting ${bankCode.toUpperCase()} VA via Core API...`);
        const chargeResponse = await coreApi.charge(coreParams);

        console.log(
          `${bankCode.toUpperCase()} Core API Response:`,
          JSON.stringify(chargeResponse, null, 2)
        );

        const vaNumber = chargeResponse.va_numbers?.[0]?.va_number;

        if (vaNumber) {
          console.log(
            `✅ Real ${bankCode.toUpperCase()} VA Number received:`,
            vaNumber
          );
          return {
            token: chargeResponse.transaction_id,
            redirectUrl: chargeResponse.redirect_url,
            qrCode: null,
            qr_string: null,
            transaction_status: chargeResponse.transaction_status,
            va_number: vaNumber,
            bank: bankCode.toUpperCase(),
          };
        } else {
          console.log(`❌ No VA number in Core API response, trying Snap...`);
          throw new Error("No VA number from Core API");
        }
      } catch (coreError) {
        console.log(`Core API failed for ${bankCode}:`, coreError.message);

        // fallback to Snap
        try {
          console.log(`Trying Snap API for ${bankCode.toUpperCase()} VA...`);
          const snapTransaction = await snap.createTransaction({
            ...baseParameter,
            enabled_payments: [`${bankCode}_va`],
            credit_card: { secure: true },
          });

          console.log(
            `✅ Snap transaction created for ${bankCode.toUpperCase()}`
          );
          return {
            token: snapTransaction.token,
            redirectUrl: snapTransaction.redirect_url,
            qrCode: null,
            qr_string: null,
            transaction_status: "pending",
            bank: bankCode.toUpperCase(),
            snap_redirect: true,
          };
        } catch (snapError) {
          console.log(
            `Snap API also failed for ${bankCode}:`,
            snapError.message
          );

          // Generate mock VA for development/testing
          const mockVANumber = generateMockVANumber(bankCode);
          console.log(`🔧 Using simulation mode with mock VA: ${mockVANumber}`);

          return {
            token: `SIM-${Date.now()}`,
            redirectUrl: null,
            qrCode: null,
            qr_string: null,
            transaction_status: "pending",
            va_number: mockVANumber,
            bank: bankCode.toUpperCase(),
            simulation: true,
          };
        }
      }
    }

    // QRIS via Core API or Snap
    if (paymentType === "qris" || paymentType === "qris_simulation") {
      try {
        const coreParams = {
          payment_type: "qris",
          transaction_details: baseParameter.transaction_details,
          customer_details: baseParameter.customer_details,
          item_details: baseParameter.item_details,
          qris: { acquirer: "gopay" },
        };

        const chargeResponse = await coreApi.charge(coreParams);

        if (chargeResponse.qr_string) {
          return {
            token: chargeResponse.transaction_id,
            redirectUrl: chargeResponse.redirect_url,
            qrCode: chargeResponse.qr_string,
            qr_string: chargeResponse.qr_string,
            transaction_status: chargeResponse.transaction_status,
          };
        }
      } catch {
        // fallback to Snap
        const snapTransaction = await snap.createTransaction({
          ...baseParameter,
          enabled_payments: ["qris"],
          credit_card: { secure: true },
        });

        const mockQRIS = generateValidTestQRIS(
          transactionId,
          amount,
          customerEmail
        );

        return {
          token: snapTransaction.token,
          redirectUrl: snapTransaction.redirect_url,
          qrCode: mockQRIS,
          qr_string: mockQRIS,
          transaction_status: "pending",
        };
      }
    }

    // Other specific Snap-based payments (e.g. dana, gopay, ovo)
    const supportedSnapTypes = ["dana", "gopay", "ovo"];
    if (supportedSnapTypes.includes(paymentType)) {
      const snapTransaction = await snap.createTransaction({
        ...baseParameter,
        enabled_payments: [paymentType],
        credit_card: { secure: true },
      });

      return {
        token: snapTransaction.token,
        redirectUrl: snapTransaction.redirect_url,
        transaction_status: "pending",
      };
    }

    // Dummy payment for test
    if (paymentType === "dummy") {
      return {
        token: transactionId,
        redirectUrl: null,
        transaction_status: "success",
      };
    }

    // Fallback: create standard Snap transaction
    const snapTransaction = await snap.createTransaction({
      ...baseParameter,
      credit_card: { secure: true },
    });

    return {
      token: snapTransaction.token,
      redirectUrl: snapTransaction.redirect_url,
      transaction_status: "pending",
    };
  } catch (error) {
    console.error("Midtrans createTransaction error:", error);

    if (paymentType === "qris" || paymentType === "qris_simulation") {
      const mockQRIS = generateValidTestQRIS(
        transactionId,
        amount,
        customerEmail
      );

      return {
        token: transactionId,
        redirectUrl: `https://simulator.sandbox.midtrans.com/qris/index?order_id=${transactionId}`,
        qrCode: mockQRIS,
        qr_string: mockQRIS,
        transaction_status: "pending",
      };
    }

    throw new Error("Gagal membuat transaksi: " + error.message);
  }
};

/**
 * Verifikasi webhook notification
 */
export const verifyNotification = async (notification) => {
  try {
    const statusResponse = await snap.transaction.notification(notification);
    const { order_id, transaction_status, fraud_status } = statusResponse;

    let status;
    if (transaction_status === "capture") {
      status = fraud_status === "challenge" ? "challenge" : "success";
    } else if (transaction_status === "settlement") {
      status = "success";
    } else if (["cancel", "deny", "expire"].includes(transaction_status)) {
      status = "failed";
    } else if (transaction_status === "pending") {
      status = "pending";
    }

    return { orderId: order_id, status };
  } catch (error) {
    console.error("❌ Midtrans notification error:", error);
    throw new Error("Gagal memverifikasi notifikasi");
  }
};

/**
 * Cek status transaksi Midtrans
 */
export const checkTransactionStatus = async (transactionId) => {
  try {
    const statusResponse = await snap.transaction.status(transactionId);
    return {
      orderId: statusResponse.order_id,
      status: statusResponse.transaction_status,
      fraudStatus: statusResponse.fraud_status,
    };
  } catch (error) {
    console.error("Midtrans checkTransactionStatus error:", error);
    throw new Error("Gagal mengecek status transaksi");
  }
};

/**
 * Simulate Midtrans webhook notification for testing
 */
export const simulateWebhookNotification = async (
  transactionId,
  status = "settlement"
) => {
  try {
    // Simulate webhook payload like real Midtrans
    const mockNotification = {
      transaction_time: new Date().toISOString(),
      transaction_status: status,
      transaction_id: `TXN-${Date.now()}`,
      status_message:
        status === "settlement"
          ? "midtrans payment notification"
          : "Transaction failed",
      status_code: status === "settlement" ? "200" : "400",
      signature_key: "mock_signature_key_for_simulation",
      payment_type: "bank_transfer",
      order_id: transactionId,
      merchant_id: "MOCK-MERCHANT-ID",
      gross_amount: "0.00", // Will be updated by caller
      fraud_status: "accept",
      currency: "IDR",
    };

    console.log(
      `🔔 Simulating webhook notification for ${transactionId}:`,
      mockNotification
    );

    return mockNotification;
  } catch (error) {
    console.error("❌ Error simulating webhook:", error);
    throw new Error("Failed to simulate webhook notification");
  }
};

/**
 * Process simulated payment settlement
 */
export const processSimulatedPayment = async (transactionId, amount) => {
  try {
    console.log(
      `💰 Processing simulated payment for ${transactionId} amount: ${amount}`
    );

    // Simulate payment processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const webhook = await simulateWebhookNotification(
      transactionId,
      "settlement"
    );
    webhook.gross_amount = amount.toString();

    return {
      success: true,
      webhook,
      message: "Pembayaran berhasil (simulasi)",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("❌ Error processing simulated payment:", error);
    throw new Error("Failed to process simulated payment");
  }
};

// Generate dummy QRIS string for testing
function generateValidTestQRIS(transactionId, amount, email) {
  const merchantAccountInfo =
    "93600016ID.CO.QRIS.WWW0215ID20232090059510303UMI";
  const merchantCategoryCode = "5999";
  const transactionCurrency = "360";
  const countryCode = "ID";
  const merchantName = "PARKGO";
  const merchantCity = "JAKARTA";
  const additionalData = transactionId.slice(-8);
  const formattedAmount = amount.toString();

  let qrString = "";

  qrString += "00" + "02" + "01";
  qrString += "01" + "02" + "12";
  qrString +=
    "26" +
    String(merchantAccountInfo.length).padStart(2, "0") +
    merchantAccountInfo;
  qrString += "52" + "04" + merchantCategoryCode;
  qrString += "53" + "03" + transactionCurrency;
  qrString +=
    "54" + String(formattedAmount.length).padStart(2, "0") + formattedAmount;
  qrString += "58" + "02" + countryCode;
  qrString +=
    "59" + String(merchantName.length).padStart(2, "0") + merchantName;
  qrString +=
    "60" + String(merchantCity.length).padStart(2, "0") + merchantCity;
  qrString +=
    "62" +
    String(4 + additionalData.length).padStart(2, "0") +
    "01" +
    String(additionalData.length).padStart(2, "0") +
    additionalData;

  const crc = calculateCRC16(qrString + "6304");
  qrString += "63" + "04" + crc.toUpperCase();

  return qrString;
}

// CRC16 generator
function calculateCRC16(data) {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).padStart(4, "0");
}

// Generate mock VA number for testing
function generateMockVANumber(bankCode) {
  const timestamp = Date.now().toString().slice(-8);

  switch (bankCode.toLowerCase()) {
    case "bri":
      return `88608${timestamp}`; // BRI VA format
    case "bca":
      return `88808${timestamp}`; // BCA VA format
    case "mandiri":
      return `88608${timestamp}`; // Mandiri VA format
    default:
      return `88888${timestamp}`;
  }
}
