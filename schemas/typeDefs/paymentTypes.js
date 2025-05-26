export const paymentTypes = `#graphql
  type Payment {
    _id: ID!
    bookingId: ID!
    booking: Booking
    transactionId: String!
    paymentMethod: String!
    amount: Float!
    status: String!
    qrCodeUrl: String
    createdAt: String!
    updatedAt: String!
  }

  type SaldoTransaction {
    _id: ID!
    userId: ID!
    user: User
    type: String!
    amount: Float!
    paymentMethod: String
    status: String!
    transactionId: String!
    qrCodeUrl: String
    createdAt: String!
  }

  input CreatePaymentInput {
    bookingId: ID!
    paymentMethod: String!
  }

  input TopUpInput {
    amount: Float!
    paymentMethod: String!
  }

  type Query {
    getPayment(id: ID!): Payment!
    getBookingPayment(bookingId: ID!): Payment!
    getMyPaymentHistory: [Payment!]!
    getMySaldoTransactions: [SaldoTransaction!]!
  }

  type Mutation {
    createPayment(input: CreatePaymentInput!): Payment!
    topUpSaldo(input: TopUpInput!): SaldoTransaction!
    confirmPayment(transactionId: String!): Payment!
    confirmTopUp(transactionId: String!): SaldoTransaction!
  }

  type Subscription {
    paymentStatusChanged(bookingId: ID!): Payment!
    saldoUpdated(userId: ID!): SaldoTransaction!
  }
`; 