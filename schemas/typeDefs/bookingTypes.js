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

  # ✅ NEW: Response type for parking bookings with stats
  type ParkingBookingsResult {
    bookings: [Booking]!
    total: Int!
    hasMore: Boolean!
    stats: BookingStats
  }

  # ✅ NEW: Booking statistics for land owner dashboard
  type BookingStats {
    totalBookings: Int!
    pendingCount: Int!
    confirmedCount: Int!
    activeCount: Int!
    completedCount: Int!
    cancelledCount: Int!
    totalRevenue: Float!
    todayBookings: Int!
  }

  type BookingResponse {
    booking: Booking!
    qr_code: String
    total_cost: Float!
    message: String
  }

  type QRResponse {
    qrCode: String!
    qrType: String!
    expiresAt: String!
    instructions: String!
    booking: Booking!
  }

  type CancelBookingResponse {
    booking: Booking!
    user: User
    refund_amount: Float
    message: String
  }

  type Query {
    getBooking(id: ID!): Booking!
    getMyActiveBookings: [Booking!]!
    getMyBookingHistory: [Booking!]!
    
    # ✅ UPDATED: Enhanced query for land owner with filters
    getParkingBookings(
      parkingId: ID!
      status: String
      startDate: String
      endDate: String
      limit: Int
      offset: Int
    ): ParkingBookingsResult!
  }

  type Mutation {
    createBooking(input: CreateBookingInput!): BookingResponse!
    cancelBooking(id: ID!): CancelBookingResponse!
    confirmBooking(id: ID!): Booking!
    extendBooking(id: ID!, additionalDuration: Int!): Booking!
    
    # ✅ FIXED: Use existing QR mutations with proper return types
    generateEntryQR(bookingId: ID!): QRResponse!
    generateExitQR(bookingId: ID!): QRResponse!
    scanEntryQR(qrCode: String!): ScanQRResponse!
    scanExitQR(qrCode: String!): ScanQRResponse!
    
    # Keep the old one for backward compatibility if needed
    generateBookingQR(bookingId: ID!): Booking!
    verifyQRCode(qrToken: String!): QRVerificationResult!
    generateParkingAccessQR(bookingId: ID!, type: String!): String!
  }

  # ✅ NEW: Response type for QR scanning
  type ScanQRResponse {
    success: Boolean!
    message: String!
    booking: Booking
    overtimeCost: Float
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
