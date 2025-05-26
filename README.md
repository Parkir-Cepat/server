# ParkirCepat Server

Backend server untuk aplikasi ParkirCepat menggunakan GraphQL, MongoDB, dan WebSocket.

## Fitur

### 🔐 Autentikasi & Otorisasi
- JWT-based authentication
- Google OAuth login
- Role-based access control (user, landowner, admin)
- Email verification
- Password reset
- Session management

### 👤 User Management
- Registrasi dengan email/password
- Login dengan Google
- Update profil (nama, foto, dll)
- Manajemen saldo (top-up, riwayat)
- Rating dan review untuk tempat parkir

### 🅿️ Manajemen Parkir
- CRUD tempat parkir oleh landowner
- Upload foto tempat parkir
- Set tarif dan slot parkir
- Geospatial search (radius & lokasi)
- Filter berdasarkan:
  - Jenis kendaraan
  - Harga
  - Rating
  - Jarak
  - Ketersediaan slot

### 📱 Booking System
- Booking langsung atau terjadwal
- QR Code untuk entry/exit
- Status tracking (pending, confirmed, completed, cancelled)
- Extend durasi parkir
- Riwayat booking
- Notifikasi real-time

### 💳 Payment System
- Integrasi Midtrans
- Multiple payment methods:
  - QRIS
  - Virtual Account
  - E-wallet
  - Credit Card
- Saldo system:
  - Top-up saldo
  - Pay with saldo
  - Riwayat transaksi
- Invoice generation

### 💬 Chat & Notifikasi
- Real-time chat antara user & landowner
- Notifikasi untuk:
  - Status booking
  - Payment status
  - Chat messages
  - System updates
- Email notifications

## Teknologi

- **Node.js** - Runtime environment
- **Apollo Server** - GraphQL server
- **MongoDB** - Database
- **Express.js** - Web framework
- **WebSocket** - Real-time communication
- **Midtrans** - Payment gateway
- **Google OAuth** - Social login
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication

## Instalasi

1. Clone repository
```bash
git clone <repository-url>
cd server
```

2. Install dependencies
```bash
npm install
```

3. Setup environment variables
```bash
cp example.env .env
```

Edit file `.env` dengan konfigurasi yang sesuai:
- `MONGODB_URI`: Connection string MongoDB
- `JWT_SECRET`: Secret key untuk JWT
- `MIDTRANS_SERVER_KEY` & `MIDTRANS_CLIENT_KEY`: Kredensial Midtrans

4. Jalankan server
```bash
npm start
```

Server akan berjalan di `http://localhost:4000/graphql`

## Struktur Project

```
server/
├── config/
│   └── db.js              # Konfigurasi database
├── helpers/
│   ├── jwt.js             # Helper JWT authentication
│   ├── midtrans.js        # Helper Midtrans payment
│   └── pubsub.js          # Helper WebSocket PubSub
├── models/
│   ├── User.js            # Model User
│   ├── ParkingLot.js      # Model Tempat Parkir
│   ├── Booking.js         # Model Pemesanan
│   ├── Payment.js         # Model Pembayaran
│   ├── SaldoTransaction.js # Model Transaksi Saldo
│   └── Chat.js            # Model Chat
├── schemas/
│   ├── typeDefs/          # GraphQL type definitions
│   └── resolvers/         # GraphQL resolvers
├── .env                   # Environment variables
├── index.js              # Entry point server
└── package.json
```

## GraphQL Schema

### User
- Registrasi dan login
- Update profil
- Manajemen saldo

### ParkingLot
- CRUD tempat parkir
- Pencarian berdasarkan lokasi
- Rating dan review

### Booking
- Buat pemesanan
- Update status booking
- Riwayat pemesanan

### Payment
- Pembayaran dengan berbagai metode
- Top up saldo
- Riwayat transaksi

### Chat
- Komunikasi real-time
- Chat berdasarkan booking
- Notifikasi pesan

## API Endpoints

- **GraphQL**: `POST /graphql`
- **WebSocket**: `ws://localhost:4000/graphql`
- **Midtrans Webhook**: `POST /midtrans-webhook`

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 4000 |
| `MONGODB_URI` | MongoDB connection string | Yes | - |
| `JWT_SECRET` | JWT secret key | Yes | - |
| `JWT_EXPIRES_IN` | JWT expiration time | No | 7d |
| `MIDTRANS_SERVER_KEY` | Midtrans server key | Yes | - |
| `MIDTRANS_CLIENT_KEY` | Midtrans client key | Yes | - |
| `MIDTRANS_IS_PRODUCTION` | Production mode | No | false |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes | - |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL | Yes | - |
| `CORS_ORIGIN` | CORS origin | No | http://localhost:3000 |
| `WS_PATH` | WebSocket path | No | /graphql |
| `CLIENT_URL` | Frontend URL | Yes | - |
| `SESSION_SECRET` | Session secret key | Yes | - |

## Development

Untuk development, jalankan dengan:
```bash
npm run dev
```

## Production

Untuk production:
```bash
npm start
```

## Database

MongoDB collections:
- `users` - Data user dan authentication
- `parking_lots` - Data tempat parkir dengan geospatial index
- `bookings` - Data pemesanan
- `payments` - Data pembayaran
- `saldo_transactions` - Data transaksi saldo
- `chats` - Data chat dan komunikasi

## Security

- Password di-hash menggunakan bcryptjs
- JWT untuk authentication
- Input validation di GraphQL resolvers
- CORS protection

## Contributing

1. Fork the project
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## GraphQL API Reference

### Queries

#### User Queries
```graphql
# Get current user info
query Me {
  me {
    _id
    email
    name
    role
    saldo
    avatar
    isEmailVerified
    createdAt
  }
}

# Get user by ID
query GetUser($userId: ID!) {
  getUserById(userId: $userId) {
    _id
    name
    email
    role
  }
}
```

#### ParkingLot Queries
```graphql
# Search nearby parking lots
query SearchParkingLots(
  $lat: Float!
  $lng: Float!
  $radius: Float
  $vehicleType: String
  $minPrice: Float
  $maxPrice: Float
) {
  searchParkingLots(
    lat: $lat
    lng: $lng
    radius: $radius
    vehicleType: $vehicleType
    minPrice: $minPrice
    maxPrice: $maxPrice
  ) {
    _id
    name
    address
    photos
    availableSlots
    tariff
    rating
    distance
  }
}

# Get parking lot details
query GetParkingLot($id: ID!) {
  getParkingLot(id: $id) {
    _id
    name
    address
    description
    photos
    location {
      coordinates
    }
    availableSlots
    totalSlots
    vehicleTypes
    tariff
    operationalHours {
      open
      close
    }
    facilities
    rating
    reviews {
      user {
        name
        avatar
      }
      rating
      comment
      createdAt
    }
  }
}
```

#### Booking Queries
```graphql
# Get active bookings
query GetMyActiveBookings {
  getMyActiveBookings {
    _id
    parkingLot {
      name
      address
    }
    vehicleType
    startTime
    duration
    cost
    status
    qrCode
    entryQR
    exitQR
  }
}

# Get booking history
query GetMyBookingHistory {
  getMyBookingHistory {
    _id
    parkingLot {
      name
    }
    startTime
    duration
    cost
    status
    payment {
      status
      paymentMethod
    }
  }
}
```

### Mutations

#### Auth Mutations
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

# Login
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

# Google Auth
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
```

#### Booking Mutations
```graphql
# Create booking
mutation CreateBooking($input: CreateBookingInput!) {
  createBooking(input: $input) {
    _id
    parkingLot {
      name
    }
    startTime
    duration
    cost
    status
  }
}

# Generate QR Code
mutation GenerateBookingQR($bookingId: ID!) {
  generateBookingQR(bookingId: $bookingId) {
    _id
    qrCode
    entryQR
    exitQR
  }
}
```

#### Payment Mutations
```graphql
# Create payment
mutation CreatePayment($input: CreatePaymentInput!) {
  createPayment(input: $input) {
    _id
    amount
    paymentMethod
    status
    paymentUrl
  }
}

# Top up saldo
mutation TopUpSaldo($input: TopUpInput!) {
  topUpSaldo(input: $input) {
    _id
    amount
    paymentUrl
  }
}
```

### Subscriptions

```graphql
# Booking status updates
subscription BookingStatusChanged($parkingLotId: ID!) {
  bookingStatusChanged(parkingLotId: $parkingLotId) {
    _id
    status
    updatedAt
  }
}

# New chat messages
subscription ChatReceived($bookingId: ID!) {
  chatReceived(bookingId: $bookingId) {
    _id
    message
    sender {
      name
      avatar
    }
    createdAt
  }
}

# Real-time notifications
subscription NotificationReceived {
  notificationReceived {
    _id
    type
    title
    message
    data
    createdAt
  }
}
```

## Error Handling

Server menggunakan format error yang konsisten:

```typescript
interface ErrorResponse {
  message: string;    // Pesan error dalam Bahasa Indonesia
  code?: string;      // Error code untuk frontend
  data?: any;         // Data tambahan jika ada
}
```

Common error codes:
- `UNAUTHENTICATED` - Token tidak valid/expired
- `FORBIDDEN` - Tidak punya akses
- `NOT_FOUND` - Data tidak ditemukan
- `BAD_REQUEST` - Input tidak valid
- `PAYMENT_FAILED` - Gagal melakukan pembayaran

## WebSocket Events

| Event | Description | Payload |
|-------|-------------|---------|
| `BOOKING_CREATED` | Booking baru dibuat | Booking object |
| `BOOKING_UPDATED` | Status booking berubah | Booking object |
| `PAYMENT_UPDATED` | Status pembayaran berubah | Payment object |
| `CHAT_SENT` | Pesan chat baru | Chat object |
| `NOTIFICATION_NEW` | Notifikasi baru | Notification object |

## Testing API

1. Buka Apollo Studio di `http://localhost:4000/graphql`
2. Set header Authorization jika perlu:
```json
{
  "Authorization": "Bearer your_jwt_token"
}
```

## Best Practices Frontend

1. **State Management**:
   - Simpan token di secure storage
   - Manage user session
   - Handle loading states
   - Cache GraphQL queries

2. **Error Handling**:
   - Display error messages
   - Retry mechanisms
   - Fallback UI

3. **Real-time Updates**:
   - Subscribe ke events yang relevan
   - Update UI secara real-time
   - Handle WebSocket reconnection

4. **Performance**:
   - Implement pagination
   - Cache responses
   - Optimize queries

5. **Security**:
   - Secure token storage
   - Input validation
   - XSS prevention

## Deployment

Server production dapat diakses di:
- GraphQL: `https://api.parkircepat.com/graphql`
- WebSocket: `wss://api.parkircepat.com/graphql`

## Support

Untuk bantuan teknis:
- Email: support@parkircepat.com
- Discord: [ParkirCepat Dev](https://discord.gg/parkircepat)
- GitHub Issues