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

      return transaction;
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

      if (payment_method === "dummy") {
        // Dummy payment - immediate success
        transaction = await Transaction.create({
          user_id: user._id,
          type: "top-up",
          amount,
          payment_method: "dummy",
          status: "success",
          transaction_id: transactionId,
          description: `Top up saldo sebesar Rp ${amount.toLocaleString()}`,
        });

        // Update user balance immediately
        await User.updateSaldo(user._id, amount);

        // Create saldo credit record
        await Transaction.create({
          user_id: user._id,
          type: "saldo_credit",
          amount,
          payment_method: "top-up",
          status: "success",
          transaction_id: transactionId,
          description: `Top up saldo berhasil`,
        });

        return {
          transaction: {
            ...transaction,
            user: await User.findById(user._id),
          },
          payment_url: null,
          qr_code: null,
        };
      } else {
        // Real payment methods
        try {
          console.log(`Creating ${payment_method} transaction...`);

          const midtransResult = await createTransaction({
            transactionId,
            amount,
            customerName: user.name || "Customer",
            customerEmail: user.email || "customer@example.com",
            paymentType: payment_method,
          });

          console.log(`${payment_method} transaction result:`, {
            token: midtransResult.token,
            hasRedirectUrl: !!midtransResult.redirectUrl,
            hasVANumber: !!midtransResult.va_number,
            hasQRCode: !!midtransResult.qr_string,
            simulation: !!midtransResult.simulation,
            snapRedirect: !!midtransResult.snap_redirect,
          });

          // Store additional data in transaction
          const transactionData = {
            user_id: user._id,
            type: "top-up",
            amount,
            payment_method,
            status: "pending",
            transaction_id: transactionId,
            qr_code_url: midtransResult.qr_string || midtransResult.redirectUrl,
            description: `Top up saldo sebesar Rp ${amount.toLocaleString()}`,
          };

          // Add VA number to transaction if available
          if (midtransResult.va_number) {
            transactionData.va_number = midtransResult.va_number;
          }

          transaction = await Transaction.create(transactionData);

          // Publish event untuk subscription
          pubsub.publish("TRANSACTION_STATUS_CHANGED", {
            transactionStatusChanged: transaction,
          });

          return {
            transaction: {
              ...transaction,
              // Add additional fields for client
              va_number: midtransResult.va_number,
              bank: midtransResult.bank,
              snap_redirect: midtransResult.snap_redirect,
              simulation: midtransResult.simulation,
            },
            payment_url: midtransResult.redirectUrl,
            qr_code: midtransResult.qr_string,
          };
        } catch (midtransError) {
          console.error(`${payment_method} error:`, midtransError);

          // Enhanced fallback for VA payments
          if (payment_method.includes("_va")) {
            console.log(
              `Creating fallback simulation for ${payment_method}...`
            );

            const bankCode = payment_method.split("_")[0];
            const mockVANumber = `SIM-${bankCode.toUpperCase()}-${Date.now()
              .toString()
              .slice(-8)}`;

            transaction = await Transaction.create({
              user_id: user._id,
              type: "top-up",
              amount,
              payment_method,
              status: "pending",
              transaction_id: transactionId,
              va_number: mockVANumber,
              description: `Top up saldo sebesar Rp ${amount.toLocaleString()} (Simulation)`,
            });

            return {
              transaction: {
                ...transaction,
                va_number: mockVANumber,
                bank: bankCode.toUpperCase(),
                simulation: true,
              },
              payment_url: null,
              qr_code: null,
            };
          }

          throw new Error(`Payment gateway error: ${midtransError.message}`);
        }
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

      // Update transaction status
      const updatedTransaction = await Transaction.updateStatus(
        transaction._id,
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

        // Update transaction status
        const updatedTransaction = await Transaction.updateStatus(
          transaction._id,
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

        // Update transaction status
        const updatedTransaction = await Transaction.updateStatus(
          transaction._id,
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
