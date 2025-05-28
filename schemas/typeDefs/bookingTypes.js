export const bookingTypes = `#graphql
  type Booking {
    _id: ID!
    user_id: ID!
    user: User
    parking_id: ID!
    parking: Parking
    vehicle_type: String!
    start_time: String!
    duration: Int!
    cost: Float!
    status: String!
    created_at: String!
    updated_at: String!
    payment: Transaction
    qr_code: String
    entry_qr: String
    exit_qr: String
  }

  input CreateBookingInput {
    parking_id: ID!
    vehicle_type: String!
    start_time: String!
    duration: Int!
  }

  type Query {
    getBooking(id: ID!): Booking!
    getMyActiveBookings: [Booking!]!
    getMyBookingHistory: [Booking!]!
    getParkingBookings(parking_id: ID!): [Booking!]!
  }

  type Mutation {
    createBooking(input: CreateBookingInput!): Booking!
    cancelBooking(id: ID!): Booking!
    confirmBooking(id: ID!): Booking!
    extendBooking(id: ID!, additionalDuration: Int!): Booking!
    generateBookingQR(bookingId: ID!): Booking!
    verifyQRCode(qrToken: String!): QRVerificationResult!
    generateParkingAccessQR(bookingId: ID!, type: String!): String!
  }

  type QRVerificationResult {
    isValid: Boolean!
    booking: Booking
    message: String!
  }
  type Subscription {
    bookingStatusChanged(parking_id: ID!): Booking!
  }
`;