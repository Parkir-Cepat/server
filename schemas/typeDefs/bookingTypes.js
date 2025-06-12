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
    # ✅ ADD: Parking session tracking fields
    parking_start_time: String
    parking_end_time: String
    remaining_time: Int
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

  # ✅ NEW: Comprehensive booking flow support
  type BookingFlowResult {
    currentStatus: String!
    nextAction: String!
    availableActions: [String!]!
    qrCodes: BookingQRCodes
    timeRemaining: Int
    overtimeWarning: Boolean
  }

  # ✅ NEW: All QR codes for a booking
  type BookingQRCodes {
    entryQR: String
    exitQR: String
    entryQRExpiry: String
    exitQRExpiry: String
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

    # ✅ NEW: Get complete booking flow status
    getBookingFlow(bookingId: ID!): BookingFlowResult!
  }

  type Mutation {
    createBooking(input: CreateBookingInput!): BookingResponse!
    cancelBooking(id: ID!): CancelBookingResponse!
    confirmBooking(id: ID!): Booking!
    extendBooking(id: ID!, additionalDuration: Int!): Booking!
    
    # ✅ ENHANCED: QR mutations with proper flow handling
    generateEntryQR(bookingId: ID!): QRResponse!
    generateExitQR(bookingId: ID!): QRResponse!
    
    # ✅ CRITICAL: Entry scan changes status confirmed → active + auto generates exit QR
    scanEntryQR(qrCode: String!): ScanEntryQRResponse!
    
    # ✅ CRITICAL: Exit scan changes status active → completed + calculates overtime
    scanExitQR(qrCode: String!): ScanExitQRResponse!
    
    # Keep the old one for backward compatibility if needed
    generateBookingQR(bookingId: ID!): Booking!
    verifyQRCode(qrToken: String!): QRVerificationResult!
    generateParkingAccessQR(bookingId: ID!, type: String!): String!
    
    # ✅ NEW: Force generate exit QR for active bookings (fallback)
    forceGenerateExitQR(bookingId: ID!): QRResponse!
    
    # ✅ NEW: Manual status transition for land owner (emergency)
    updateBookingStatus(bookingId: ID!, newStatus: String!, reason: String): Booking!
  }

  # ✅ ENHANCED: Specific response for entry QR scanning
  type ScanEntryQRResponse {
    success: Boolean!
    message: String!
    booking: Booking!
    # ✅ AUTO-GENERATED: Exit QR is automatically created when entry is scanned
    exitQR: QRResponse
    parkingStartTime: String!
  }

  # ✅ ENHANCED: Specific response for exit QR scanning  
  type ScanExitQRResponse {
    success: Boolean!
    message: String!
    booking: Booking!
    # ✅ OVERTIME: Calculate overtime costs if exceeded duration
    overtimeCost: Float
    totalParkingDuration: Int!
    actualEndTime: String!
  }

  # ✅ KEEP: Generic response for backward compatibility
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
