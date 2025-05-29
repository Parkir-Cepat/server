import { Transaction } from "../../models/Transaction.js";
import { Booking } from "../../models/Booking.js";
import { User } from "../../models/User.js";
import { GraphQLError } from "graphql";
import { PubSub } from "graphql-subscriptions";
import { createTransaction } from "../../helpers/midtrans.js";

const pubsub = new PubSub();

export const transactionResolvers = {
  Transaction: {
    user: async (transaction) => {
      return await User.findById(transaction.user_id);
    },
    booking: async (transaction) => {
      if (!transaction.booking_id) return null;
      return await Booking.findById(transaction.booking_id);
    }
  },

  Query: {
    getTransaction: async (_, { id }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const transaction = await Transaction.findById(id);
      if (!transaction) throw new Error("Transaksi tidak ditemukan");

      // Pastikan user hanya bisa melihat transaksinya sendiri
      if (transaction.user_id.toString() !== user._id.toString() && user.role !== "admin") {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return transaction;
    },
    getMyTransactionHistory: async (_, { type, status, limit }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      return await Transaction.findByUser(user._id, { type, status, limit });
    },
    getMyPaymentHistory: async (_, __, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      return await Transaction.findByUser(user._id, { type: 'payment' });
    },
    getMySaldoTransactions: async (_, __, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });      // Get both saldo credit and debit transactions
      const transactions = await Transaction.findByUser(user._id, { 
        type: { $in: ['top-up', 'saldo_credit', 'saldo_debit'] }
      });
      
      return transactions;
    },
    getBookingPayment: async (_, { booking_id }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const booking = await Booking.findById(booking_id);
      if (!booking) throw new Error("Booking tidak ditemukan");

      // Pastikan user hanya bisa melihat transaksi bookingnya sendiri
      if (booking.user_id.toString() !== user._id.toString()) {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return await Transaction.findByBooking(booking_id);
    }
  },
  Mutation: {
    createPayment: async (_, { input }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const { booking_id, payment_method } = input;

      // Validasi booking
      const booking = await Booking.findById(booking_id);
      if (!booking) throw new Error("Booking tidak ditemukan");

      if (booking.user_id.toString() !== user._id.toString()) {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      // Cek apakah sudah ada transaksi pembayaran untuk booking ini
      const existingTransaction = await Transaction.findByBooking(booking_id);
      if (existingTransaction && existingTransaction.type === 'payment') {
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
          description: `Pembayaran booking parkir #${booking_id}`
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
          description: `Pembayaran booking menggunakan saldo`
        });

      } else {
        // Buat token Midtrans untuk pembayaran
        const midtransResult = await createTransaction({
          transactionId: `PAY-${Date.now()}`,
          amount: booking.price,
          customerName: user.name,
          customerEmail: user.email
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
          description: `Pembayaran booking parkir #${booking_id}`
        });
      }

      // Publish event untuk subscription
      pubsub.publish("TRANSACTION_STATUS_CHANGED", {
        transactionStatusChanged: transaction
      });

      return transaction;
    },
    topUpSaldo: async (_, { input }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const { amount, payment_method } = input;

      if (amount < 10000) {
        throw new Error("Minimal top up adalah Rp 10.000");
      }

      // Buat token Midtrans untuk top up
      const midtransResult = await createTransaction({
        transactionId: `TOPUP-${Date.now()}`,
        amount,
        customerName: user.name,
        customerEmail: user.email
      });

      // Buat transaksi top up
      const transaction = await Transaction.create({
        user_id: user._id,
        type: "top-up",
        amount,
        payment_method,
        status: "pending",
        transaction_id: `TOPUP-${Date.now()}`,
        qr_code_url: midtransResult.redirectUrl,
        description: `Top up saldo sebesar Rp ${amount.toLocaleString()}`
      });

      // Publish event untuk subscription
      pubsub.publish("TRANSACTION_STATUS_CHANGED", {
        transactionStatusChanged: transaction
      });

      // Return PaymentResponse structure
      return {
        transaction,
        payment_url: midtransResult.redirectUrl,
        qr_code: midtransResult.qrCode || null
      };
    },
    confirmPayment: async (_, { transaction_id }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const transaction = await Transaction.findByTransactionId(transaction_id);
      if (!transaction) throw new Error("Transaksi tidak ditemukan");

      if (transaction.user_id.toString() !== user._id.toString() && user.role !== "admin") {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const updatedTransaction = await Transaction.updateStatus(transaction._id, "success");      // Jika transaksi top up, update saldo user
      if (transaction.type === "top-up") {
        await User.updateSaldo(transaction.user_id, transaction.amount);

        // Buat record transaksi saldo kredit
        await Transaction.create({
          user_id: transaction.user_id,
          type: "saldo_credit",
          amount: transaction.amount,
          payment_method: "top-up",
          status: "success",
          transaction_id: transaction.transaction_id,
          description: `Top up saldo berhasil`
        });
      }

      // Publish event untuk subscription
      pubsub.publish("TRANSACTION_STATUS_CHANGED", {
        transactionStatusChanged: updatedTransaction
      });

      return updatedTransaction;
    }
  },

  Subscription: {
    transactionStatusChanged: {
      subscribe: (_, __, { user }) => {
        if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: 'UNAUTHENTICATED' }
        });
        return pubsub.asyncIterator(["TRANSACTION_STATUS_CHANGED"]);
      }
    }
  }
};
