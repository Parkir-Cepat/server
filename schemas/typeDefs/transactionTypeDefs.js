import { gql } from "apollo-server-express";

export const transactionTypeDefs = gql`
  scalar Date

  type Transaction {
    _id: ID!
    user_id: String!
    user: User
    booking_id: String
    booking: Booking
    transaction_id: String!
    type: String!
    payment_method: String!
    amount: Float!
    status: String!
    qr_code_url: String
    va_number: String
    bank: String
    description: String
    createdAt: String
    updatedAt: String
  }

  type PaymentResponse {
    transaction: Transaction!
    payment_url: String
    qr_code: String
    va_number: String
    bank: String
    simulation: Boolean
  }

  type PaymentSimulationResult {
    success: Boolean
    message: String
    transaction: Transaction
    user: User
    webhook_data: String
  }

  type TransactionStatusResponse {
    transaction_status: String
    order_id: String
    gross_amount: Int
    payment_type: String
  }

  input TopUpInput {
    amount: Float!
    payment_method: String!
  }

  input PaymentInput {
    booking_id: String!
    payment_method: String!
  }

  input WebhookInput {
    order_id: String!
    transaction_status: String!
    fraud_status: String
    status_code: String
    gross_amount: String
    payment_type: String
    signature_key: String
  }

  extend type Query {
    getTransaction(id: ID!): Transaction
    getMyTransactionHistory(
      type: String
      status: String
      limit: Int
    ): [Transaction]
    getMyPaymentHistory: [Transaction]
    getMySaldoTransactions: [Transaction]
    getBookingPayment(booking_id: String!): Transaction
    checkTransactionStatus(transaction_id: String!): Transaction
  }

  extend type Mutation {
    createPayment(input: PaymentInput!): Transaction
    topUpSaldo(input: TopUpInput!): PaymentResponse
    confirmPayment(transaction_id: String!): Transaction
    simulatePaymentSuccess(transaction_id: String!): PaymentSimulationResult
    handleMidtransWebhook(
      webhookData: WebhookInput!
    ): TransactionStatusResponse!
  }

  extend type Subscription {
    transactionStatusChanged: Transaction
  }
`;
