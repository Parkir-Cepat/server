export const transactionTypes = `#graphql
  type Transaction {
    _id: ID!
    user_id: ID!
    user: User
    booking_id: ID
    booking: Booking
    transaction_id: String!
    type: String!
    payment_method: String!
    amount: Float!
    status: String!
    qr_code_url: String
    created_at: String!
    updated_at: String!
  }

  input CreatePaymentInput {
    booking_id: ID!
    payment_method: String!
  }

  input TopUpInput {
    amount: Float!
    payment_method: String!
  }

  type PaymentResponse {
    transaction: Transaction!
    payment_url: String
    qr_code: String
  }

  type Query {
    getTransaction(id: ID!): Transaction!
    getBookingPayment(booking_id: ID!): Transaction!
    getMyTransactionHistory: [Transaction!]!
    getMyPaymentHistory: [Transaction!]!
    getMySaldoTransactions: [Transaction!]!
  }

  type Mutation {
    createPayment(input: CreatePaymentInput!): PaymentResponse!
    topUpSaldo(input: TopUpInput!): PaymentResponse!
    confirmPayment(transaction_id: String!): Transaction!
    handleMidtransNotification(notification: JSON!): Transaction
  }

  type Subscription {
    transactionStatusChanged(user_id: ID!): Transaction!
    paymentStatusChanged(booking_id: ID!): Transaction!
    saldoUpdated(user_id: ID!): Transaction!
  }
`;
