# ParkirCepat Server

Backend server untuk aplikasi ParkirCepat menggunakan GraphQL, MongoDB, dan WebSocket.

## Fitur

- 🚀 GraphQL API dengan Apollo Server
- 🔌 Real-time communication dengan WebSocket subscriptions
- 🗄️ MongoDB dengan native driver
- 🔐 JWT authentication
- 💳 Integrasi Midtrans payment gateway
- 📍 Geospatial search untuk lokasi parkir

## Teknologi

- **Node.js** - Runtime environment
- **Apollo Server** - GraphQL server
- **MongoDB** - Database
- **Express.js** - Web framework
- **WebSocket** - Real-time communication
- **Midtrans** - Payment gateway
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

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 4000 |
| `MONGODB_URI` | MongoDB connection string | - |
| `JWT_SECRET` | JWT secret key | - |
| `JWT_EXPIRES_IN` | JWT expiration time | 7d |
| `MIDTRANS_SERVER_KEY` | Midtrans server key | - |
| `MIDTRANS_CLIENT_KEY` | Midtrans client key | - |
| `MIDTRANS_IS_PRODUCTION` | Production mode | false |
| `CORS_ORIGIN` | CORS origin | http://localhost:3000 |
| `WS_PATH` | WebSocket path | /graphql |

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