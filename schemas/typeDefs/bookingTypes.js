export const bookingTypes = `#graphql
  type Booking {
    _id: ID!
    userId: ID!
    user: User
    parkingLotId: ID!
    parkingLot: ParkingLot
    vehicleType: String!
    startTime: String!
    duration: Int!
    cost: Float!
    status: String!
    createdAt: String!
    payment: Payment
    qrCode: String
    entryQR: String
    exitQR: String
  }

  input CreateBookingInput {
    parkingLotId: ID!
    vehicleType: String!
    startTime: String!
    duration: Int!
  }

  type Query {
    getBooking(id: ID!): Booking!
    getMyActiveBookings: [Booking!]!
    getMyBookingHistory: [Booking!]!
    getParkingLotBookings(parkingLotId: ID!): [Booking!]!
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
    bookingStatusChanged(parkingLotId: ID!): Booking!
  }
`; 