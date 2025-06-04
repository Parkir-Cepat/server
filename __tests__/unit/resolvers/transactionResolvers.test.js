import { transactionResolvers } from "../../../schemas/resolvers/transactionResolvers.js";
import { Transaction } from "../../../models/Transaction.js";
import { Booking } from "../../../models/Booking.js";
import { User } from "../../../models/User.js";
import { GraphQLError } from "graphql";
import { ObjectId } from "mongodb";

// Mock dependencies
jest.mock("../../../models/Transaction.js", () => ({
  Transaction: {
    findById: jest.fn().mockImplementation(() => Promise.resolve({ id: '123', amount: 100 })),
    findByUser: jest.fn(),
    findByBooking: jest.fn(),
    findByTransactionId: jest.fn(),
    create: jest.fn().mockImplementation(() => Promise.resolve({ id: '123', amount: 100 })),
    updateStatus: jest.fn()
  }
}));

jest.mock("../../../models/Booking.js", () => ({
  Booking: {
    findById: jest.fn()
  }
}));

jest.mock("../../../models/User.js", () => ({
  User: {
    findById: jest.fn(),
    updateSaldo: jest.fn()
  }
}));

jest.mock("../../../helpers/midtrans.js", () => ({
  createTransaction: jest.fn(),
  processSimulatedPayment: jest.fn()
}));

describe("Transaction Resolvers", () => {
  let mockContext;
  const mockUserId = new ObjectId();
  const mockTransactionId = new ObjectId();
  const mockBookingId = new ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
    mockContext = {
      user: {
        _id: mockUserId,
        email: "test@example.com",
        role: "user"
      }
    };
  });

  describe("Query", () => {
    describe("getTransaction", () => {
      it("should throw error if user is not authenticated", async () => {
        const mockContext = { user: null };
        
        await expect(transactionResolvers.Query.getTransaction(null, { id: mockTransactionId }, mockContext))
          .rejects
          .toThrow("Anda harus login terlebih dahulu");
      });

      it("should throw error if transaction not found", async () => {
        Transaction.findById.mockResolvedValue(null);

        await expect(transactionResolvers.Query.getTransaction(null, { id: mockTransactionId }, mockContext))
          .rejects
          .toThrow("Transaksi tidak ditemukan");
      });

      it("should throw error if user does not own the transaction", async () => {
        const mockTransaction = {
          _id: mockTransactionId,
          user_id: new ObjectId(), // Different user
          amount: 50000,
          type: "payment"
        };

        Transaction.findById.mockResolvedValue(mockTransaction);

        await expect(transactionResolvers.Query.getTransaction(null, { id: mockTransactionId }, mockContext))
          .rejects
          .toThrow("Anda tidak memiliki akses");
      });

      it("should return transaction if user owns it", async () => {
        const mockTransaction = {
          _id: mockTransactionId,
          user_id: mockUserId,
          amount: 50000,
          type: "payment"
        };

        Transaction.findById.mockResolvedValue(mockTransaction);

        const result = await transactionResolvers.Query.getTransaction(
          null,
          { id: mockTransactionId },
          mockContext
        );

        expect(result).toEqual(mockTransaction);
      });

      it("should allow admin to view any transaction", async () => {
        const adminContext = {
          user: { ...mockContext.user, role: "admin" }
        };

        const mockTransaction = {
          _id: mockTransactionId,
          user_id: new ObjectId(),
          amount: 50000,
          type: "payment"
        };

        Transaction.findById.mockResolvedValue(mockTransaction);

        const result = await transactionResolvers.Query.getTransaction(
          null,
          { id: mockTransactionId },
          adminContext
        );

        expect(result).toEqual(mockTransaction);
      });
    });

    describe("getMyTransactionHistory", () => {
      it("should throw error if user is not authenticated", async () => {
        const mockContext = { user: null };
        
        await expect(transactionResolvers.Query.getMyTransactionHistory(null, {}, mockContext))
          .rejects
          .toThrow("Anda harus login terlebih dahulu");
      });

      it("should return user's transaction history", async () => {
        const mockTransactions = [
          {
            _id: mockTransactionId,
            user_id: mockUserId,
            amount: 50000,
            type: "payment",
            status: "success"
          }
        ];

        Transaction.findByUser.mockResolvedValue(mockTransactions);

        const result = await transactionResolvers.Query.getMyTransactionHistory(
          null,
          { type: "payment", status: "success", limit: 10 },
          mockContext
        );

        expect(result).toEqual(mockTransactions);
        expect(Transaction.findByUser).toHaveBeenCalledWith(
          mockUserId,
          { type: "payment", status: "success", limit: 10 }
        );
      });
    });

    describe("getBookingPayment", () => {
      it("should throw error if user is not authenticated", async () => {
        const mockContext = { user: null };
        
        await expect(transactionResolvers.Query.getBookingPayment(null, { booking_id: mockBookingId }, mockContext))
          .rejects
          .toThrow("Anda harus login terlebih dahulu");
      });

      it("should throw error if booking not found", async () => {
        Booking.findById.mockResolvedValue(null);

        await expect(transactionResolvers.Query.getBookingPayment(null, { booking_id: mockBookingId }, mockContext))
          .rejects
          .toThrow("Booking tidak ditemukan");
      });

      it("should throw error if user does not own the booking", async () => {
        const mockBooking = {
          _id: mockBookingId,
          user_id: new ObjectId(), // Different user
          status: "pending"
        };

        Booking.findById.mockResolvedValue(mockBooking);

        await expect(transactionResolvers.Query.getBookingPayment(null, { booking_id: mockBookingId }, mockContext))
          .rejects
          .toThrow("Anda tidak memiliki akses");
      });

      it("should return booking payment if user owns the booking", async () => {
        const mockBooking = {
          _id: mockBookingId,
          user_id: mockUserId,
          status: "pending"
        };

        const mockTransaction = {
          _id: mockTransactionId,
          booking_id: mockBookingId,
          user_id: mockUserId,
          amount: 50000,
          type: "payment",
          status: "pending"
        };

        Booking.findById.mockResolvedValue(mockBooking);
        Transaction.findByBooking.mockResolvedValue(mockTransaction);

        const result = await transactionResolvers.Query.getBookingPayment(
          null,
          { booking_id: mockBookingId },
          mockContext
        );

        expect(result).toEqual(mockTransaction);
      });
    });

    describe("checkTransactionStatus", () => {
      const mockTransactionId = "order-123";

      it("should throw error if user is not authenticated", async () => {
        const mockContext = { user: null };
        
        await expect(transactionResolvers.Query.checkTransactionStatus(
          null,
          { transaction_id: mockTransactionId },
          mockContext
        ))
          .rejects
          .toThrow("Anda harus login terlebih dahulu");
      });

      it("should throw error if transaction not found", async () => {
        Transaction.findByTransactionId.mockResolvedValue(null);

        await expect(transactionResolvers.Query.checkTransactionStatus(
          null,
          { transaction_id: mockTransactionId },
          mockContext
        ))
          .rejects
          .toThrow("Transaksi tidak ditemukan");
      });

      it("should return success status immediately if transaction is already successful", async () => {
        const mockTransaction = {
          _id: new ObjectId(),
          transaction_id: mockTransactionId,
          user_id: mockUserId,
          status: "success",
          type: "payment"
        };

        const mockUser = {
          _id: mockUserId,
          saldo: 100000
        };

        Transaction.findByTransactionId.mockResolvedValue(mockTransaction);
        User.findById.mockResolvedValue(mockUser);

        const result = await transactionResolvers.Query.checkTransactionStatus(
          null,
          { transaction_id: mockTransactionId },
          mockContext
        );

        expect(result).toEqual({
          ...mockTransaction,
          user: mockUser
        });
      });
    });
  });

  describe("Type Resolvers", () => {
    describe("Transaction.user", () => {
      it("should resolve transaction user", async () => {
        const mockTransaction = {
          _id: mockTransactionId,
          user_id: mockUserId
        };

        const mockUser = {
          _id: mockUserId,
          name: "Test User",
          email: "test@example.com"
        };

        User.findById.mockResolvedValue(mockUser);

        const result = await transactionResolvers.Transaction.user(mockTransaction);

        expect(result).toEqual(mockUser);
        expect(User.findById).toHaveBeenCalledWith(mockUserId);
      });
    });

    describe("Transaction.booking", () => {
      it("should return null if no booking_id", async () => {
        const mockTransaction = {
          _id: mockTransactionId,
          user_id: mockUserId,
          booking_id: null
        };

        const result = await transactionResolvers.Transaction.booking(mockTransaction);

        expect(result).toBeNull();
        expect(Booking.findById).not.toHaveBeenCalled();
      });

      it("should resolve transaction booking", async () => {
        const mockTransaction = {
          _id: mockTransactionId,
          user_id: mockUserId,
          booking_id: mockBookingId
        };

        const mockBooking = {
          _id: mockBookingId,
          user_id: mockUserId,
          status: "pending"
        };

        Booking.findById.mockResolvedValue(mockBooking);

        const result = await transactionResolvers.Transaction.booking(mockTransaction);

        expect(result).toEqual(mockBooking);
        expect(Booking.findById).toHaveBeenCalledWith(mockBookingId);
      });
    });
  });

  describe("Mutation", () => {
    describe("createTransaction", () => {
      it("should throw an error if user is not authenticated", async () => {
        const mockContext = { user: null };

        await expect(
          transactionResolvers.Mutation.createTransaction(null, { input: {} }, mockContext)
        ).rejects.toThrow("Anda harus login terlebih dahulu");
      });

      it("should create a transaction successfully", async () => {
        const mockInput = {
          amount: 100000,
          type: "payment",
          booking_id: mockBookingId,
        };

        const mockTransaction = {
          _id: mockTransactionId,
          user_id: mockUserId,
          ...mockInput,
        };

        Transaction.create.mockResolvedValue(mockTransaction);

        const result = await transactionResolvers.Mutation.createTransaction(
          null,
          { input: mockInput },
          mockContext
        );

        expect(result).toEqual(mockTransaction);
        expect(Transaction.create).toHaveBeenCalledWith({
          user_id: mockUserId,
          ...mockInput,
        });
      });
    });

    describe("updateTransactionStatus", () => {
      it("should throw an error if user is not authenticated", async () => {
        const mockContext = { user: null };

        await expect(
          transactionResolvers.Mutation.updateTransactionStatus(null, { id: mockTransactionId, status: "completed" }, mockContext)
        ).rejects.toThrow("Anda harus login terlebih dahulu");
      });

      it("should update the transaction status successfully", async () => {
        const mockTransaction = {
          _id: mockTransactionId,
          user_id: mockUserId,
          amount: 100000,
          type: "payment",
          status: "pending",
        };

        Transaction.findById.mockResolvedValue(mockTransaction);
        Transaction.updateStatus.mockResolvedValue({ ...mockTransaction, status: "completed" });

        const result = await transactionResolvers.Mutation.updateTransactionStatus(
          null,
          { id: mockTransactionId, status: "completed" },
          mockContext
        );

        expect(result.status).toBe("completed");
        expect(Transaction.updateStatus).toHaveBeenCalledWith(mockTransactionId, "completed");
      });
    });
  });
});