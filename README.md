# Parkirin Server - GraphQL API Documentation

Parkirin is a comprehensive parking booking and management system with real-time features. This GraphQL API provides authentication, parking management, booking system, payment processing, chat functionality, and real-time notifications.

## 🚀 Server Configuration

### Endpoints
- **GraphQL API**: `http://localhost:3000/graphql`
- **WebSocket (Subscriptions)**: `ws://localhost:3000/graphql`
- **Midtrans Webhook**: `http://localhost:3000/midtrans-webhook`
- **Google OAuth**: `http://localhost:3000/auth/google`

### Environment Variables
```env
PORT=3000
WS_PATH=/graphql
CLIENT_URL=http://localhost:5173
SESSION_SECRET=your-secret-key
```

### CORS Configuration
Allowed origins:
- `http://localhost:3000` 
- `http://localhost:5173`

## 🔐 Authentication

### JWT Token Authentication
All authenticated operations require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Google OAuth Flow
1. Redirect to `/auth/google` 
2. Callback handled at `/auth/google/callback`
3. Client receives token via redirect parameter

## 📋 GraphQL Schema Documentation

## 🔑 User & Authentication

### Queries
```graphql
# Get current user profile
query Me {
  me {
    _id
    email
    name
    role
    saldo
    avatar
    is_email_verified
    created_at
  }
}

# Get user by ID
query GetUserById($userId: ID!) {
  getUserById(userId: $userId) {
    _id
    name
    email
    avatar
  }
}

# Get dashboard statistics
query GetDashboardStats {
  getDashboardStats {
    totalParkingLots
    parkingLotsChange
    monthlyEarnings
    earningsChange
    activeBookings
    bookingsChange
    totalUsers
    usersChange
    platformRevenue
    revenueChange
    pendingApprovals
    totalBookings
    totalSpent
    spentChange
    walletChange
  }
}

# Get recent activity
query GetRecentActivity($limit: Int) {
  getRecentActivity(limit: $limit) {
    id
    type
    title
    description
    timestamp
    location
    bookingId
    parkingId
    chatId
  }
}
```

### Mutations
```graphql
# Register new user
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    token
    user {
      _id
      email
      name
      role
    }
  }
}

# Login with email/password
mutation Login($input: LoginInput!) {
  login(input: $input) {
    token
    user {
      _id
      email
      name
      role
      saldo
    }
  }
}

# Google OAuth authentication
mutation GoogleAuth($token: String!) {
  googleAuth(token: $token) {
    token
    user {
      _id
      name
      email
      avatar
    }
  }
}

# Update user profile
mutation UpdateProfile($name: String!) {
  updateProfile(name: $name) {
    _id
    name
    updated_at
  }
}

# Change password
mutation ChangePassword($oldPassword: String!, $newPassword: String!) {
  changePassword(oldPassword: $oldPassword, newPassword: $newPassword)
}
```

### Input Types
```graphql
input RegisterInput {
  email: String!
  password: String!
  name: String!
  role: String
}

input LoginInput {
  email: String!
  password: String!
}
```

## 🅿️ Parking Management

### Queries
```graphql
# Get parking by ID
query GetParking($id: ID!) {
  getParking(id: $id) {
    _id
    name
    address
    location {
      type
      coordinates
    }
    owner {
      _id
      name
    }
    capacity {
      car
      motorcycle
    }
    available {
      car
      motorcycle
    }
    rates {
      car
      motorcycle
    }
    operational_hours {
      open
      close
    }
    facilities
    images
    status
    rating
    review_count
    created_at
  }
}

# Get nearby parking lots
query GetNearbyParkings($longitude: Float!, $latitude: Float!, $maxDistance: Float, $limit: Int) {
  getNearbyParkings(longitude: $longitude, latitude: $latitude, maxDistance: $maxDistance, limit: $limit) {
    _id
    name
    address
    location {
      coordinates
    }
    available {
      car
      motorcycle
    }
    rates {
      car
      motorcycle
    }
    rating
  }
}

# Get my parking lots (owner only)
query GetMyParkings {
  getMyParkings {
    _id
    name
    address
    capacity {
      car
      motorcycle
    }
    available {
      car
      motorcycle
    }
    status
    rating
  }
}

# Search parkings with filters
query SearchParkings($query: String!, $vehicleType: String, $sortBy: String, $limit: Int) {
  searchParkings(query: $query, vehicleType: $vehicleType, sortBy: $sortBy, limit: $limit) {
    _id
    name
    address
    available {
      car
      motorcycle
    }
    rates {
      car
      motorcycle
    }
    rating
  }
}
```

### Mutations
```graphql
# Create new parking lot
mutation CreateParking($input: CreateParkingInput!) {
  createParking(input: $input) {
    _id
    name
    address
    status
  }
}

# Update parking information
mutation UpdateParking($id: ID!, $input: UpdateParkingInput!) {
  updateParking(id: $id, input: $input) {
    _id
    name
    address
    updated_at
  }
}

# Delete parking lot
mutation DeleteParking($id: ID!) {
  deleteParking(id: $id)
}

# Add parking image
mutation AddParkingImage($id: ID!, $imageUrl: String!) {
  addParkingImage(id: $id, imageUrl: $imageUrl) {
    _id
    images
  }
}

# Remove parking image
mutation RemoveParkingImage($id: ID!, $imageUrl: String!) {
  removeParkingImage(id: $id, imageUrl: $imageUrl) {
    _id
    images
  }
}
```

### Input Types
```graphql
input CreateParkingInput {
  name: String!
  address: String!
  location: LocationInput!
  capacity: CapacityInput!
  rates: RatesInput!
  operational_hours: OperationalHoursInput!
  facilities: [String!]!
  images: [String!]!
}

input LocationInput {
  coordinates: [Float!]!
}

input CapacityInput {
  car: Int!
  motorcycle: Int!
}

input RatesInput {
  car: Float!
  motorcycle: Float!
}

input OperationalHoursInput {
  open: String!
  close: String!
}
```

## 📅 Booking System

### Queries
```graphql
# Get booking by ID
query GetBooking($id: ID!) {
  getBooking(id: $id) {
    _id
    user {
      _id
      name
    }
    parking {
      _id
      name
      address
    }
    vehicle_type
    start_time
    duration
    cost
    status
    qr_code
    entry_qr
    exit_qr
    created_at
  }
}

# Get my active bookings
query GetMyActiveBookings {
  getMyActiveBookings {
    _id
    parking {
      name
      address
    }
    vehicle_type
    start_time
    duration
    cost
    status
    qr_code
  }
}

# Get my booking history
query GetMyBookingHistory {
  getMyBookingHistory {
    _id
    parking {
      name
      address
    }
    vehicle_type
    start_time
    duration
    cost
    status
    created_at
  }
}

# Get parking bookings (owner only)
query GetParkingBookings($parking_id: ID!) {
  getParkingBookings(parking_id: $parking_id) {
    _id
    user {
      name
    }
    vehicle_type
    start_time
    duration
    cost
    status
  }
}
```

### Mutations
```graphql
# Create new booking
mutation CreateBooking($input: CreateBookingInput!) {
  createBooking(input: $input) {
    _id
    start_time
    duration
    cost
    status
  }
}

# Cancel booking
mutation CancelBooking($id: ID!) {
  cancelBooking(id: $id) {
    _id
    status
    updated_at
  }
}

# Confirm booking
mutation ConfirmBooking($id: ID!) {
  confirmBooking(id: $id) {
    _id
    status
    updated_at
  }
}

# Extend booking duration
mutation ExtendBooking($id: ID!, $additionalDuration: Int!) {
  extendBooking(id: $id, additionalDuration: $additionalDuration) {
    _id
    duration
    cost
    updated_at
  }
}

# Generate booking QR code
mutation GenerateBookingQR($bookingId: ID!) {
  generateBookingQR(bookingId: $bookingId) {
    _id
    qr_code
  }
}

# Generate parking access QR
mutation GenerateParkingAccessQR($bookingId: ID!, $type: String!) {
  generateParkingAccessQR(bookingId: $bookingId, type: $type)
}

# Verify QR code
mutation VerifyQRCode($qrToken: String!) {
  verifyQRCode(qrToken: $qrToken) {
    isValid
    message
    booking {
      _id
      status
      user {
        name
      }
      parking {
        name
      }
    }
  }
}
```

### Input Types
```graphql
input CreateBookingInput {
  parking_id: ID!
  vehicle_type: String!
  start_time: String!
  duration: Int!
}
```

### Subscriptions
```graphql
# Subscribe to booking status changes
subscription BookingStatusChanged($parking_id: ID!) {
  bookingStatusChanged(parking_id: $parking_id) {
    _id
    status
    updated_at
  }
}
```

## 💳 Payment & Transactions

### Queries
```graphql
# Get transaction by ID
query GetTransaction($id: ID!) {
  getTransaction(id: $id) {
    _id
    user {
      name
    }
    booking {
      _id
    }
    transaction_id
    type
    payment_method
    amount
    status
    qr_code_url
    created_at
  }
}

# Get booking payment
query GetBookingPayment($booking_id: ID!) {
  getBookingPayment(booking_id: $booking_id) {
    _id
    transaction_id
    amount
    status
    qr_code_url
  }
}

# Get my transaction history
query GetMyTransactionHistory {
  getMyTransactionHistory {
    _id
    type
    amount
    status
    created_at
  }
}

# Get my payment history
query GetMyPaymentHistory {
  getMyPaymentHistory {
    _id
    booking {
      parking {
        name
      }
    }
    amount
    payment_method
    status
    created_at
  }
}

# Get my saldo transactions
query GetMySaldoTransactions {
  getMySaldoTransactions {
    _id
    type
    amount
    status
    created_at
  }
}
```

### Mutations
```graphql
# Create payment for booking
mutation CreatePayment($input: CreatePaymentInput!) {
  createPayment(input: $input) {
    transaction {
      _id
      transaction_id
      amount
      status
    }
    payment_url
    qr_code
  }
}

# Top up saldo/wallet
mutation TopUpSaldo($input: TopUpInput!) {
  topUpSaldo(input: $input) {
    transaction {
      _id
      transaction_id
      amount
      status
    }
    payment_url
    qr_code
  }
}

# Confirm payment (from webhook)
mutation ConfirmPayment($transaction_id: String!) {
  confirmPayment(transaction_id: $transaction_id) {
    _id
    status
    updated_at
  }
}
```

### Input Types
```graphql
input CreatePaymentInput {
  booking_id: ID!
  payment_method: String!
}

input TopUpInput {
  amount: Float!
  payment_method: String!
}
```

### Subscriptions
```graphql
# Subscribe to transaction status changes
subscription TransactionStatusChanged($user_id: ID!) {
  transactionStatusChanged(user_id: $user_id) {
    _id
    status
    updated_at
  }
}

# Subscribe to payment status changes
subscription PaymentStatusChanged($booking_id: ID!) {
  paymentStatusChanged(booking_id: $booking_id) {
    _id
    status
    updated_at
  }
}

# Subscribe to saldo updates
subscription SaldoUpdated($user_id: ID!) {
  saldoUpdated(user_id: $user_id) {
    _id
    type
    amount
    status
    created_at
  }
}
```

## 💬 Chat & Rooms

### Room Queries
```graphql
# Get room by ID
query GetRoom($id: ID!) {
  getRoom(id: $id) {
    _id
    name
    type
    privacy
    creator {
      _id
      name
    }
    max_participants
    participants {
      _id
      name
      avatar
    }
    participant_count
    is_full
    created_at
  }
}

# Get my rooms
query GetMyRooms {
  getMyRooms {
    _id
    name
    type
    privacy
    participant_count
    last_message {
      message
      created_at
    }
  }
}

# Get public rooms
query GetPublicRooms($limit: Int, $parking_id: ID) {
  getPublicRooms(limit: $limit, parking_id: $parking_id) {
    _id
    name
    type
    participant_count
    max_participants
    is_full
  }
}

# Get private room with specific user
query GetPrivateRoomWithUser($user_id: ID!, $parking_id: ID) {
  getPrivateRoomWithUser(user_id: $user_id, parking_id: $parking_id) {
    _id
    name
    type
  }
}

# Get room participants
query GetRoomParticipants($room_id: ID!) {
  getRoomParticipants(room_id: $room_id) {
    _id
    user {
      _id
      name
      avatar
    }
    role
    joined_at
  }
}

# Get parking rooms
query GetParkingRooms($parking_id: ID!) {
  getParkingRooms(parking_id: $parking_id) {
    _id
    name
    type
    privacy
    participant_count
  }
}
```

### Chat Queries
```graphql
# Get room messages
query GetRoomMessages($room_id: ID!, $limit: Int, $offset: Int) {
  getRoomMessages(room_id: $room_id, limit: $limit, offset: $offset) {
    _id
    sender {
      _id
      name
      avatar
    }
    message
    message_type
    read_by
    created_at
  }
}

# Get unread messages
query GetUnreadMessages($room_id: ID) {
  getUnreadMessages(room_id: $room_id) {
    _id
    sender {
      name
    }
    message
    created_at
  }
}

# Get message status
query GetMessageStatus($message_id: ID!) {
  getMessageStatus(message_id: $message_id) {
    message_id
    read_by
    delivered_to
  }
}

# Get my recent chats
query GetMyRecentChats {
  getMyRecentChats {
    _id
    room {
      _id
      name
    }
    message
    created_at
  }
}
```

### Room Mutations
```graphql
# Create new room
mutation CreateRoom($input: CreateRoomInput!) {
  createRoom(input: $input) {
    _id
    name
    type
    privacy
  }
}

# Create private room
mutation CreatePrivateRoom($input: CreatePrivateRoomInput!) {
  createPrivateRoom(input: $input) {
    _id
    name
    type
  }
}

# Join room
mutation JoinRoom($input: JoinRoomInput!) {
  joinRoom(input: $input) {
    _id
    name
    participant_count
  }
}

# Leave room
mutation LeaveRoom($room_id: ID!) {
  leaveRoom(room_id: $room_id)
}

# Add participants to room
mutation AddParticipants($room_id: ID!, $participant_ids: [ID!]!) {
  addParticipants(room_id: $room_id, participant_ids: $participant_ids) {
    _id
    participant_count
  }
}

# Remove participant from room
mutation RemoveParticipant($room_id: ID!, $user_id: ID!) {
  removeParticipant(room_id: $room_id, user_id: $user_id) {
    _id
    participant_count
  }
}

# Update room
mutation UpdateRoom($room_id: ID!, $name: String) {
  updateRoom(room_id: $room_id, name: $name) {
    _id
    name
    updated_at
  }
}

# Delete room
mutation DeleteRoom($id: ID!) {
  deleteRoom(id: $id)
}
```

### Chat Mutations
```graphql
# Send message
mutation SendMessage($input: SendMessageInput!) {
  sendMessage(input: $input) {
    _id
    sender {
      _id
      name
      avatar
    }
    room_id
    message
    message_type
    created_at
  }
}

# Mark message as read
mutation MarkMessageAsRead($message_id: ID!) {
  markMessageAsRead(message_id: $message_id) {
    _id
    read_by
  }
}

# Mark all room messages as read
mutation MarkRoomMessagesAsRead($room_id: ID!) {
  markRoomMessagesAsRead(room_id: $room_id)
}

# Delete message
mutation DeleteMessage($message_id: ID!) {
  deleteMessage(message_id: $message_id)
}

# Edit message
mutation EditMessage($message_id: ID!, $new_message: String!) {
  editMessage(message_id: $message_id, new_message: $new_message) {
    _id
    message
    updated_at
  }
}
```

### Input Types
```graphql
input CreateRoomInput {
  name: String!
  type: String!
  privacy: String!
  max_participants: Int
  parking_id: ID
  participant_ids: [ID!]
}

input CreatePrivateRoomInput {
  participant_id: ID!
  parking_id: ID
}

input JoinRoomInput {
  room_id: ID!
}

input SendMessageInput {
  room_id: ID!
  message: String!
  message_type: String
}
```

### Chat Subscriptions
```graphql
# Subscribe to new messages
subscription MessageReceived($room_id: ID!) {
  messageReceived(room_id: $room_id) {
    _id
    sender {
      _id
      name
      avatar
    }
    room_id
    message
    message_type
    created_at
  }
}

# Subscribe to message read status
subscription MessageRead($room_id: ID!) {
  messageRead(room_id: $room_id) {
    _id
    read_by
  }
}

# Subscribe to message deletions
subscription MessageDeleted($room_id: ID!) {
  messageDeleted(room_id: $room_id)
}

# Subscribe to message edits
subscription MessageEdited($room_id: ID!) {
  messageEdited(room_id: $room_id) {
    _id
    message
    updated_at
  }
}

# Subscribe to room updates
subscription RoomUpdated($room_id: ID!) {
  roomUpdated(room_id: $room_id) {
    _id
    name
    participant_count
  }
}

# Subscribe to room participant changes
subscription RoomParticipantJoined($room_id: ID!) {
  roomParticipantJoined(room_id: $room_id) {
    _id
    user {
      name
    }
    joined_at
  }
}

subscription RoomParticipantLeft($room_id: ID!) {
  roomParticipantLeft(room_id: $room_id) {
    _id
    user {
      name
    }
  }
}
```

## 🔔 Notifications

### Queries
```graphql
# Get my notifications
query GetMyNotifications($limit: Int) {
  getMyNotifications(limit: $limit) {
    _id
    type
    title
    message
    data
    is_read
    created_at
  }
}

# Get unread notification count
query GetUnreadNotificationCount {
  getUnreadNotificationCount
}
```

### Mutations
```graphql
# Mark notification as read
mutation MarkNotificationAsRead($id: ID!) {
  markNotificationAsRead(id: $id)
}

# Mark all notifications as read
mutation MarkAllNotificationsAsRead {
  markAllNotificationsAsRead
}
```

### Subscriptions
```graphql
# Subscribe to new notifications
subscription NotificationReceived {
  notificationReceived {
    _id
    type
    title
    message
    data
    is_read
    created_at
  }
}
```

## ⚠️ Error Handling

The API uses standard GraphQL error extensions for error categorization:

### Error Codes
- `UNAUTHENTICATED` - Token tidak valid/expired
- `FORBIDDEN` - Tidak memiliki akses/permission
- `NOT_FOUND` - Data tidak ditemukan
- `BAD_USER_INPUT` - Input tidak valid
- `INTERNAL_ERROR` - Server error

### Example Error Response
```json
{
  "errors": [
    {
      "message": "Anda harus login terlebih dahulu",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

## 🔌 WebSocket Connection

For real-time features, establish WebSocket connection:

```javascript
import { WebSocketLink } from '@apollo/client/link/ws';

const wsLink = new WebSocketLink({
  uri: 'ws://localhost:3000/graphql',
  options: {
    reconnect: true,
    connectionParams: {
      authorization: `Bearer ${token}`,
    },
  },
});
```

## 💰 Payment Integration

### Midtrans Integration
- Webhook endpoint: `/midtrans-webhook`
- Test endpoint: `/test-webhook`
- Supported payment methods: QRIS, Virtual Account, E-wallet, Credit Card

### Payment Flow
1. Create payment/top-up → Receive payment URL/QR
2. User completes payment in Midtrans
3. Webhook updates transaction status
4. For top-up: User saldo automatically updated

## 🚀 Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set environment variables**
   ```bash
   cp .env.example .env
   # Fill in your environment variables
   ```

3. **Start server**
   ```bash
   npm start
   ```

4. **Access GraphQL Playground**
   Visit `http://localhost:3000/graphql` in your browser

## 📱 Frontend Integration Example

```javascript
import { ApolloClient, InMemoryCache, split, HttpLink } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { WebSocketLink } from '@apollo/client/link/ws';

const httpLink = new HttpLink({
  uri: 'http://localhost:3000/graphql',
  headers: {
    authorization: `Bearer ${localStorage.getItem('token')}`,
  },
});

const wsLink = new WebSocketLink({
  uri: 'ws://localhost:3000/graphql',
  options: {
    reconnect: true,
    connectionParams: {
      authorization: `Bearer ${localStorage.getItem('token')}`,
    },
  },
});

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink,
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
```

## 📚 Additional Resources

- **GraphQL Playground**: `http://localhost:3000/graphql`
- **WebSocket Endpoint**: `ws://localhost:3000/graphql`
- **Google OAuth**: `http://localhost:3000/auth/google`

For detailed examples and frontend integration, refer to the client documentation in the `client/` directory.