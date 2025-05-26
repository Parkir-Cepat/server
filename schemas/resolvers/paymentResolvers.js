import { Payment } from "../../models/Payment.js";
import { SaldoTransaction } from "../../models/SaldoTransaction.js";
import { Booking } from "../../models/Booking.js";
import { User } from "../../models/User.js";
import { GraphQLError } from "graphql";
import { PubSub } from "graphql-subscriptions";
import { createTransaction } from "../../helpers/midtrans.js";

const pubsub = new PubSub();

export const paymentResolvers = {
  Payment: {
    booking: async (payment) => {
      return await Booking.findById(payment.bookingId);
    }
  },

  SaldoTransaction: {
    user: async (transaction) => {
      return await User.findById(transaction.userId);
    }
  },

  Query: {
    getPayment: async (_, { id }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const payment = await Payment.findById(id);
      if (!payment) throw new Error("Pembayaran tidak ditemukan");

      const booking = await Booking.findById(payment.bookingId);
      if (booking.userId.toString() !== user._id) {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return payment;
    },

    getBookingPayment: async (_, { bookingId }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const booking = await Booking.findById(bookingId);
      if (!booking) throw new Error("Booking tidak ditemukan");

      if (booking.userId.toString() !== user._id) {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const payment = await Payment.getByBooking(bookingId);
      if (!payment) throw new Error("Pembayaran tidak ditemukan");

      return payment;
    },

    getMyPaymentHistory: async (_, __, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      return await Payment.getByUser(user._id);
    },

    getMySaldoTransactions: async (_, __, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });
      return await SaldoTransaction.getByUser(user._id);
    }
  },

  Mutation: {
    createPayment: async (_, { input }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const { bookingId, paymentMethod } = input;

      // Validasi booking
      const booking = await Booking.findById(bookingId);
      if (!booking) throw new Error("Booking tidak ditemukan");

      if (booking.userId.toString() !== user._id) {
        throw new GraphQLError("Anda tidak memiliki akses", {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      // Cek apakah sudah ada pembayaran untuk booking ini
      const existingPayment = await Payment.getByBooking(bookingId);
      if (existingPayment) {
        throw new Error("Pembayaran untuk booking ini sudah ada");
      }

      let payment;

      if (paymentMethod === "saldo") {
        // Validasi saldo
        const currentUser = await User.findById(user._id);
        if (currentUser.saldo < booking.cost) {
          throw new Error("Saldo tidak mencukupi");
        }

        // Buat pembayaran dengan saldo
        payment = await Payment.create({
          bookingId,
          transactionId: `SAL-${Date.now()}`,
          paymentMethod,
          amount: booking.cost,
          status: "success"
        });

        // Update saldo user
        await User.updateSaldo(user._id, -booking.cost);

        // Catat transaksi saldo
        await SaldoTransaction.create({
          userId: user._id,
          type: "debit",
          amount: booking.cost,
          status: "success",
          transactionId: payment.transactionId
        });

      } else {
        // Buat token Midtrans untuk pembayaran
        const midtransResult = await createTransaction({
          transactionId: `ORD-${Date.now()}`,
          amount: booking.cost,
          customerName: user.name,
          customerEmail: user.email
        });

        // Buat pembayaran dengan metode lain
        payment = await Payment.create({
          bookingId,
          transactionId: `ORD-${Date.now()}`,
          paymentMethod,
          amount: booking.cost,
          status: "pending",
          qrCodeUrl: midtransResult.redirectUrl
        });
      }

      // Publish event untuk subscription
      pubsub.publish("PAYMENT_STATUS_CHANGED", {
        paymentStatusChanged: payment
      });

      return payment;
    },

    topUpSaldo: async (_, { input }, { user }) => {
      if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
        extensions: { code: 'UNAUTHENTICATED' }
      });

      const { amount, paymentMethod } = input;

      // Validasi jumlah top up
      if (amount < 10000) {
        throw new Error("Minimal top up Rp 10.000");
      }

      // Buat token Midtrans untuk top up
      const midtransResult = await createTransaction({
        transactionId: `TOP-${Date.now()}`,
        amount,
        customerName: user.name,
        customerEmail: user.email
      });

      // Catat transaksi saldo
      const transaction = await SaldoTransaction.create({
        userId: user._id,
        type: "credit",
        amount,
        paymentMethod,
        status: "pending",
        transactionId: `TOP-${Date.now()}`,
        qrCodeUrl: midtransResult.redirectUrl
      });

      // Publish event untuk subscription
      pubsub.publish("SALDO_UPDATED", {
        saldoUpdated: transaction
      });

      return transaction;
    },

    confirmPayment: async (_, { transactionId }) => {
      const payment = await Payment.findByTransactionId(transactionId);
      if (!payment) throw new Error("Pembayaran tidak ditemukan");

      const updatedPayment = await Payment.updateStatus(payment._id, "success");

      // Publish event untuk subscription
      pubsub.publish("PAYMENT_STATUS_CHANGED", {
        paymentStatusChanged: updatedPayment
      });

      return updatedPayment;
    },

    confirmTopUp: async (_, { transactionId }) => {
      const transaction = await SaldoTransaction.findByTransactionId(transactionId);
      if (!transaction) throw new Error("Transaksi tidak ditemukan");

      const updatedTransaction = await SaldoTransaction.updateStatus(transaction._id, "success");

      // Update saldo user
      await User.updateSaldo(transaction.userId, transaction.amount);

      // Publish event untuk subscription
      pubsub.publish("SALDO_UPDATED", {
        saldoUpdated: updatedTransaction
      });

      return updatedTransaction;
    }
  },

  Subscription: {
    paymentStatusChanged: {
      subscribe: (_, __, { user }) => {
        if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: 'UNAUTHENTICATED' }
        });
        return pubsub.asyncIterator(["PAYMENT_STATUS_CHANGED"]);
      }
    },

    saldoUpdated: {
      subscribe: (_, __, { user }) => {
        if (!user) throw new GraphQLError("Anda harus login terlebih dahulu", {
          extensions: { code: 'UNAUTHENTICATED' }
        });
        return pubsub.asyncIterator(["SALDO_UPDATED"]);
      }
    }
  }
}; 