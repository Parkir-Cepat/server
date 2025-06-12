import { Transaction } from "../../models/Transaction.js";
import { Booking } from "../../models/Booking.js";
import { User } from "../../models/User.js";
import { GraphQLError } from "graphql";
import { PubSub } from "graphql-subscriptions";
import {
  createTransaction,
  processSimulatedPayment,
} from "../../helpers/midtrans.js";

const pubsub = new PubSub();

// Helper function untuk check Midtrans status
const checkMidtransStatus = async (transactionId) => {
  try {
    const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
    const authString = Buffer.from(MIDTRANS_SERVER_KEY + ":").toString(
      "base64"
    );

    console.log(`🔍 Checking Midtrans status for: ${transactionId}`);

    const response = await fetch(
      `https://api.sandbox.midtrans.com/v2/${transactionId}/status`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Basic ${authString}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`📊 Midtrans API response for ${transactionId}:`, {
        transaction_status: data.transaction_status,
        fraud_status: data.fraud_status,
        status_code: data.status_code,
      });
      return data;
    } else {
      console.log(
        `❌ Midtrans API response not ok: ${response.status} ${response.statusText}`
      );
      const errorText = await response.text();
      console.log(`❌ Error response body:`, errorText);
    }

    return null;
  } catch (error) {
    console.error("❌ Midtrans status check error:", error);
    return null;
  }
};

export const transactionResolvers = {
  Transaction: {
    user: async (transaction) => {
      return await User.findById(transaction.user_id);
    },
    booking: async (transaction) => {
      if (!transaction.booking_id) return null;
      return await Booking.findById(transaction.booking_id);
    },
  },

  Query: {
    getTransaction: async (_, { id }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const transaction = await Transaction.findById(id);
      if (!transaction) throw new Error("Transaksi tidak ditemukan");

      // Pastikan user hanya bisa melihat transaksinya sendiri
      if (
        transaction.user_id.toString() !== user._id.toString() &&
        user.role !== "admin"
      ) {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      return transaction;
    },
    getMyTransactionHistory: async (_, { type, status, limit }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      return await Transaction.findByUser(user._id, { type, status, limit });
    },
    getMyPaymentHistory: async (_, __, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      return await Transaction.findByUser(user._id, { type: "payment" });
    },
    getMySaldoTransactions: async (_, __, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        }); // Get both saldo credit and debit transactions
      const transactions = await Transaction.findByUser(user._id, {
        type: { $in: ["top-up", "saldo_credit", "saldo_debit"] },
      });

      return transactions;
    },
    getBookingPayment: async (_, { booking_id }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const booking = await Booking.findById(booking_id);
      if (!booking) throw new Error("Booking tidak ditemukan");

      // Pastikan user hanya bisa melihat transaksi bookingnya sendiri
      if (booking.user_id.toString() !== user._id.toString()) {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      return await Transaction.findByBooking(booking_id);
    },

    checkTransactionStatus: async (_, { transaction_id }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      console.log(`🔍 Checking transaction status for: ${transaction_id}`);

      const transaction = await Transaction.findByTransactionId(transaction_id);
      if (!transaction) throw new Error("Transaksi tidak ditemukan");

      if (
        transaction.user_id.toString() !== user._id.toString() &&
        user.role !== "admin"
      ) {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      console.log(`📋 Current transaction status in DB: ${transaction.status}`);
      console.log(`📋 Transaction document _id: ${transaction._id}`);
      console.log(`📋 Transaction document details:`, {
        _id: transaction._id,
        transaction_id: transaction.transaction_id,
        status: transaction.status,
        type: transaction.type,
      });

      // Always populate user data for balance info
      const userdata = await User.findById(transaction.user_id);

      // If already success, return immediately with user data - NO MORE PROCESSING
      if (transaction.status === "success") {
        console.log(
          `✅ Transaction ${transaction_id} already successful, returning with balance: ${userdata.saldo}`
        );
        return {
          ...transaction,
          user: userdata,
        };
      }

      // 🚀 Auto-check Midtrans status ONLY if still pending
      if (transaction.status === "pending") {
        try {
          console.log(
            `🔄 Auto-checking Midtrans status for pending transaction: ${transaction_id}`
          );

          // Check status dari Midtrans API
          const midtransStatus = await checkMidtransStatus(
            transaction.transaction_id
          );

          if (midtransStatus) {
            console.log(`📊 Midtrans status check result:`, {
              transaction_status: midtransStatus.transaction_status,
              fraud_status: midtransStatus.fraud_status,
              payment_type: midtransStatus.payment_type,
            });

            // More restrictive success detection - ONLY settlement or capture
            const isSuccess =
              midtransStatus.transaction_status === "settlement" ||
              midtransStatus.transaction_status === "capture";

            const isFailed =
              midtransStatus.transaction_status === "deny" ||
              midtransStatus.transaction_status === "cancel" ||
              midtransStatus.transaction_status === "expire" ||
              midtransStatus.transaction_status === "failure";

            if (isSuccess) {
              console.log(
                `✅ Payment confirmed as successful for ${transaction_id}`
              );
              console.log(
                `🔄 Will update transaction with ID: ${transaction.transaction_id}`
              );

              // Verify the transaction ID format before update
              console.log(
                `🔍 Transaction ID to update: "${transaction.transaction_id}" (length: ${transaction.transaction_id.length})`
              );

              // Update transaction status to success - use the exact transaction_id from DB
              const updatedTransaction = await Transaction.updateStatus(
                transaction.transaction_id, // Use the exact value from database
                "success"
              );

              console.log(`✅ Transaction status updated to success in DB`);

              // Update user balance untuk top-up - with better error handling
              if (transaction.type === "top-up") {
                console.log(
                  `💰 Updating user balance for top-up: +${transaction.amount}`
                );

                try {
                  const updatedUser = await User.updateSaldo(
                    transaction.user_id,
                    transaction.amount
                  );

                  console.log(
                    `💰 Balance updated successfully. New balance: ${updatedUser.saldo}`
                  );

                  // Create saldo credit record only after successful balance update
                  await Transaction.create({
                    user_id: transaction.user_id,
                    type: "saldo_credit",
                    amount: transaction.amount,
                    payment_method: "auto_polling_success",
                    status: "success",
                    transaction_id: `${transaction.transaction_id}-CREDIT`,
                    description: `✅ Auto-detected payment success via polling - Saldo ditambahkan dari ${midtransStatus.payment_type}`,
                  });

                  // Publish real-time update
                  pubsub.publish("TRANSACTION_STATUS_CHANGED", {
                    transactionStatusChanged: {
                      ...updatedTransaction,
                      status: "success",
                    },
                  });

                  // Return transaction with updated user data
                  return {
                    ...updatedTransaction,
                    user: updatedUser,
                  };
                } catch (balanceError) {
                  console.error(
                    `❌ Failed to update user balance:`,
                    balanceError
                  );

                  // If balance update fails, revert transaction status back to pending
                  console.log(
                    `🔄 Reverting transaction status back to pending due to balance update failure`
                  );
                  await Transaction.updateStatus(
                    transaction.transaction_id,
                    "pending"
                  );

                  // Still return the original transaction to avoid breaking the flow
                  return {
                    ...transaction,
                    user: userdata,
                  };
                }
              }

              // Publish real-time update for non-topup transactions
              pubsub.publish("TRANSACTION_STATUS_CHANGED", {
                transactionStatusChanged: {
                  ...updatedTransaction,
                  status: "success",
                },
              });

              return {
                ...updatedTransaction,
                user: userdata,
              };
            } else if (isFailed) {
              console.log(
                `❌ Payment failed/cancelled for ${transaction_id}: ${midtransStatus.transaction_status}`
              );

              // Update to failed status - use exact transaction_id from DB
              const failedTransaction = await Transaction.updateStatus(
                transaction.transaction_id, // Use exact value from database
                "failed"
              );

              return {
                ...failedTransaction,
                user: userdata,
              };
            } else {
              console.log(
                `⏳ Payment still pending for ${transaction_id}: ${midtransStatus.transaction_status}`
              );
            }
          } else {
            console.log(
              `⚠️ Could not get Midtrans status for ${transaction_id}`
            );
          }
        } catch (error) {
          console.error("❌ Auto-check Midtrans error:", error);
          // Return original transaction jika auto-check gagal
        }
      }

      return {
        ...transaction,
        user: userdata,
      };
    },
  },

  Mutation: {
    createPayment: async (_, { input }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const { booking_id, payment_method } = input;

      // Validasi booking
      const booking = await Booking.findById(booking_id);
      if (!booking) throw new Error("Booking tidak ditemukan");

      if (booking.user_id.toString() !== user._id.toString()) {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      // Cek apakah sudah ada transaksi pembayaran untuk booking ini
      const existingTransaction = await Transaction.findByBooking(booking_id);
      if (existingTransaction && existingTransaction.type === "payment") {
        throw new Error("Transaksi pembayaran untuk booking ini sudah ada");
      }

      let transaction;

      if (payment_method === "saldo") {
        // Validasi saldo
        const currentUser = await User.findById(user._id);
        if (currentUser.saldo < booking.price) {
          throw new Error("Saldo tidak mencukupi");
        }

        // Buat transaksi pembayaran dengan saldo
        transaction = await Transaction.create({
          user_id: user._id,
          booking_id,
          type: "payment",
          amount: booking.price,
          payment_method,
          status: "success",
          transaction_id: `PAY-${Date.now()}`,
          description: `Pembayaran booking parkir #${booking_id}`,
        });

        // Update saldo user
        await User.updateSaldo(user._id, -booking.price);

        // Catat transaksi saldo
        await Transaction.create({
          user_id: user._id,
          type: "saldo_debit",
          amount: booking.price,
          payment_method: "saldo",
          status: "success",
          transaction_id: transaction.transaction_id,
          description: `Pembayaran booking menggunakan saldo`,
        });
      } else {
        // Buat token Midtrans untuk pembayaran
        const midtransResult = await createTransaction({
          transactionId: `PAY-${Date.now()}`,
          amount: booking.price,
          customerName: user.name,
          customerEmail: user.email,
        });

        // Buat transaksi pembayaran dengan metode lain
        transaction = await Transaction.create({
          user_id: user._id,
          booking_id,
          type: "payment",
          amount: booking.price,
          payment_method,
          status: "pending",
          transaction_id: `PAY-${Date.now()}`,
          qr_code_url: midtransResult.redirectUrl,
          description: `Pembayaran booking parkir #${booking_id}`,
        });
      }

      // Publish event untuk subscription
      pubsub.publish("TRANSACTION_STATUS_CHANGED", {
        transactionStatusChanged: transaction,
      });

      return transaction;
    },
    topUpSaldo: async (_, { input }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const { amount, payment_method } = input;

      if (amount < 1000) {
        throw new Error("Minimal top up adalah Rp 1.000");
      }

      let transaction;
      const transactionId = `TOPUP-${Date.now()}`;

      try {
        const midtransResult = await createTransaction({
          transactionId,
          amount,
          customerName: user.name || "Customer",
          customerEmail: user.email || "customer@example.com",
          paymentType: payment_method,
        });
        console.log(`Midtrans result:`, midtransResult);

        // Store additional data in transaction
        const transactionData = {
          user_id: user._id,
          type: "top-up",
          amount,
          payment_method,
          status: "pending",
          transaction_id: transactionId,
          qr_code_url:
            midtransResult.qr_string ||
            midtransResult.redirectUrl ||
            `https://app.sandbox.midtrans.com/snap/v4/redirection/${midtransResult.token}`,
          description: `Top up saldo sebesar Rp ${amount.toLocaleString()}`,
        };

        // Add VA number and bank to transaction if available
        if (midtransResult.va_number) {
          transactionData.va_number = midtransResult.va_number;
        } else if (payment_method.includes("_va")) {
          // Generate fallback VA number for VA payments when Midtrans doesn't provide one
          const bankCode = payment_method.split("_")[0];
          const bankName = bankCode.toUpperCase();
          let fallbackVANumber;

          switch (bankName) {
            case "MANDIRI":
              fallbackVANumber = `70012${Date.now().toString().slice(-10)}`;
              break;
            case "BNI":
              fallbackVANumber = `8000${Date.now().toString().slice(-12)}`;
              break;
            case "PERMATA":
              fallbackVANumber = `85400${Date.now().toString().slice(-11)}`;
              break;
            case "BCA":
              fallbackVANumber = `28064${Date.now().toString().slice(-15)}`;
              break;
            case "BRI":
              fallbackVANumber = `12345${Date.now().toString().slice(-12)}`;
              break;
            default:
              fallbackVANumber = `VA${bankName}${Date.now()
                .toString()
                .slice(-10)}`;
          }

          console.log(
            `🔄 Generated fallback VA for ${bankName}: ${fallbackVANumber}`
          );
          transactionData.va_number = fallbackVANumber;

          // Also set bank if not provided by Midtrans
          if (!midtransResult.bank) {
            transactionData.bank = bankName;
          }
        }

        if (midtransResult.bank) {
          transactionData.bank = midtransResult.bank;
        }

        transaction = await Transaction.create(transactionData);

        // Publish event untuk subscription
        pubsub.publish("TRANSACTION_STATUS_CHANGED", {
          transactionStatusChanged: transaction,
        });

        // Determine which VA number and bank to return (from Midtrans or fallback)
        const finalVANumber =
          midtransResult.va_number || transactionData.va_number;
        const finalBank = midtransResult.bank || transactionData.bank;

        console.log(
          `📋 Final transaction data - VA: ${finalVANumber}, Bank: ${finalBank}`
        );

        return {
          transaction: {
            ...transaction,
            va_number: finalVANumber,
            bank: finalBank,
            snap_redirect: midtransResult.snap_redirect,
            simulation:
              midtransResult.simulation ||
              (midtransResult.snap_redirect && !midtransResult.va_number),
          },
          payment_url:
            midtransResult.redirectUrl ||
            `https://app.sandbox.midtrans.com/snap/v4/redirection/${midtransResult.token}`,
          qr_code: midtransResult.qr_string,
        };
      } catch (midtransError) {
        console.error(`${payment_method} error:`, midtransError);

        // Enhanced fallback for ALL VA payments (BRI, BCA, Mandiri, BNI, Permata)
        if (payment_method.includes("_va")) {
          console.log(`Creating fallback simulation for ${payment_method}...`);

          const bankCode = payment_method.split("_")[0];
          const bankName = bankCode.toUpperCase();

          // Generate bank-specific VA number format
          let mockVANumber;
          switch (bankName) {
            case "BCA":
              mockVANumber = `28064${Date.now().toString().slice(-15)}`;
              break;
            case "BRI":
              mockVANumber = `12345${Date.now().toString().slice(-12)}`;
              break;
            case "MANDIRI":
              mockVANumber = `70012${Date.now().toString().slice(-10)}`;
              break;
            case "BNI":
              mockVANumber = `8000${Date.now().toString().slice(-12)}`;
              break;
            case "PERMATA":
              mockVANumber = `85400${Date.now().toString().slice(-11)}`;
              break;
            default:
              mockVANumber = `SIM-${bankName}-${Date.now()
                .toString()
                .slice(-8)}`;
          }

          console.log(`🚨 Complete fallback for ${bankName}: ${mockVANumber}`);

          transaction = await Transaction.create({
            user_id: user._id,
            type: "top-up",
            amount,
            payment_method,
            status: "pending",
            transaction_id: transactionId,
            va_number: mockVANumber,
            bank: bankName,
            description: `Top up saldo sebesar Rp ${amount.toLocaleString()} (${bankName} Simulation)`,
          });

          return {
            transaction: {
              ...transaction,
              va_number: mockVANumber,
              bank: bankName,
              simulation: true,
            },
            payment_url: null,
            qr_code: null,
          };
        }

        throw new Error(`Payment gateway error: ${midtransError.message}`);
      }
    },

    // Add mutation to manually confirm payment for testing
    confirmPayment: async (_, { transaction_id }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      const transaction = await Transaction.findByTransactionId(transaction_id);
      if (!transaction) {
        throw new Error("Transaction not found");
      }

      if (transaction.user_id.toString() !== user._id.toString()) {
        throw new Error("Unauthorized");
      }

      if (transaction.status === "success") {
        throw new Error("Transaction already confirmed");
      }

      // Update transaction status - use transaction_id
      const updatedTransaction = await Transaction.updateStatus(
        transaction_id, // Use transaction_id string
        "success"
      );

      // Update user balance
      await User.updateSaldo(transaction.user_id, transaction.amount);

      // Create saldo credit record
      await Transaction.create({
        user_id: transaction.user_id,
        type: "saldo_credit",
        amount: transaction.amount,
        payment_method: "manual_confirm",
        status: "success",
        transaction_id: transaction.transaction_id,
        description: "Top up saldo berhasil (Manual Confirm)",
      });

      const updatedUser = await User.findById(user._id);

      return {
        transaction_id: updatedTransaction.transaction_id,
        status: updatedTransaction.status,
        user: updatedUser,
      };
    },

    // Add mutation to simulate payment success
    simulatePaymentSuccess: async (_, { transaction_id }, { user }) => {
      if (!user)
        throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: "UNAUTHENTICATED" },
        });

      try {
        const transaction = await Transaction.findByTransactionId(
          transaction_id
        );
        if (!transaction) {
          throw new Error("Transaction not found");
        }

        if (transaction.user_id.toString() !== user._id.toString()) {
          throw new Error("Unauthorized");
        }

        if (transaction.status === "success") {
          throw new Error("Transaction already completed");
        }

        console.log(`🎯 Simulating payment success for ${transaction_id}`);

        // Process simulated payment
        const simulationResult = await processSimulatedPayment(
          transaction_id,
          transaction.amount
        );

        // Update transaction status - use transaction_id
        const updatedTransaction = await Transaction.updateStatus(
          transaction_id, // Use transaction_id string
          "success"
        );

        // Update user balance
        await User.updateSaldo(transaction.user_id, transaction.amount);

        // Create saldo credit record
        await Transaction.create({
          user_id: transaction.user_id,
          type: "saldo_credit",
          amount: transaction.amount,
          payment_method: "simulation_webhook",
          status: "success",
          transaction_id: `${transaction.transaction_id}-CREDIT`,
          description: `✅ ${simulationResult.message} - Saldo berhasil ditambahkan`,
        });

        const updatedUser = await User.findById(user._id);

        // Publish real-time update
        pubsub.publish("TRANSACTION_STATUS_CHANGED", {
          transactionStatusChanged: {
            ...updatedTransaction,
            status: "success",
            message: simulationResult.message,
          },
        });

        console.log(`✅ Payment simulation completed for ${transaction_id}`);
        console.log(`💰 User balance updated: ${updatedUser.saldo}`);

        return {
          success: true,
          message: simulationResult.message,
          transaction: updatedTransaction,
          user: updatedUser,
          webhook_data: JSON.stringify(simulationResult.webhook, null, 2),
        };
      } catch (error) {
        console.error("❌ Simulate payment error:", error);
        throw new Error(`Payment simulation failed: ${error.message}`);
      }
    },

    handleMidtransWebhook: async (_, { webhookData }) => {
      try {
        const { order_id, transaction_status, fraud_status } = webhookData;

        const transaction = await Transaction.findByTransactionId(order_id);
        if (!transaction) {
          throw new Error("Transaksi tidak ditemukan");
        }

        let newStatus = transaction.status;

        if (
          transaction_status === "capture" ||
          transaction_status === "settlement"
        ) {
          if (fraud_status === "accept" || !fraud_status) {
            newStatus = "success";
          }
        } else if (transaction_status === "pending") {
          newStatus = "pending";
        } else if (
          transaction_status === "deny" ||
          transaction_status === "expire" ||
          transaction_status === "cancel"
        ) {
          newStatus = "failed";
        }

        // Update transaction status - use order_id (transaction_id)
        const updatedTransaction = await Transaction.updateStatus(
          order_id, // Use transaction_id string
          newStatus
        );

        // If successful top-up, update user balance
        if (newStatus === "success" && transaction.type === "top-up") {
          await User.updateSaldo(transaction.user_id, transaction.amount);

          // Create saldo credit record
          await Transaction.create({
            user_id: transaction.user_id,
            type: "saldo_credit",
            amount: transaction.amount,
            payment_method: "top-up",
            status: "success",
            transaction_id: transaction.transaction_id,
            description: `Top up saldo berhasil`,
          });
        }

        // Publish event untuk subscription
        pubsub.publish("TRANSACTION_STATUS_CHANGED", {
          transactionStatusChanged: updatedTransaction,
        });

        return updatedTransaction;
      } catch (error) {
        console.error("Webhook error:", error);
        throw new Error("Failed to process webhook");
      }
    },
  },

  Subscription: {
    transactionStatusChanged: {
      subscribe: (_, __, { user }) => {
        if (!user)
          throw new GraphQLError("Anda harus login terlebih dahulu", {
            extensions: { code: "UNAUTHENTICATED" },
          });
        return pubsub.asyncIterator(["TRANSACTION_STATUS_CHANGED"]);
      },
    },
  },
};
