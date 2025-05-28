Hi GitHub Copilot, bantu saya membuat aplikasi frontend "ParkirCepat" yang terintegrasi dengan backend GraphQL. Ini adalah aplikasi booking dan manajemen parkir dengan fitur real-time.

TEKNOLOGI YANG HARUS DIGUNAKAN:
- React dengan Next.js 14 (App Router)
- Apollo Client untuk GraphQL
- Tailwind CSS untuk UI
- NextAuth.js untuk autentikasi
- WebSockets untuk real-time features
- Jest dan React Testing Library untuk testing
- Zustand untuk state management

BACKEND ENDPOINT:
- GraphQL API: http://localhost:4000/graphql
- WebSocket: ws://localhost:4000/graphql

KEY FEATURES DAN PAGES YANG HARUS DIBUAT:

1. AUTENTIKASI
- Register dengan email/password dan validasi
- Login dengan email/password
- Login dengan Google OAuth
- Protected routes berdasarkan role user (user, landowner, admin)
- Implementasi JWT token storage dan refresh

2. USER DASHBOARD
- Profile management dengan avatar upload
- Wallet system dengan:
  * Display saldo
  * Top-up menggunakan Midtrans (QRIS, Virtual Account, E-wallet)
  * Riwayat transaksi

3. PENCARIAN PARKIR
- Map-based interface dengan geolocation
- Filter pencarian berdasarkan:
  * Radius/jarak
  * Harga
  * Rating
  * Ketersediaan slot
- Detail view tempat parkir dengan:
  * Gallery foto
  * Informasi harga dan ketersediaan
  * Ratings dan reviews
  * Directions

4. BOOKING SYSTEM
- Create booking dengan pilihan durasi
- QR Code display untuk entry/exit
- Booking status tracking (pending, confirmed, completed, cancelled)
- Extension durasi booking
- Booking history

5. CHAT & NOTIFICATIONS
- Real-time chat antara user dan owner parkir
- Notifications untuk booking status changes
- Payment confirmations
- Unread messages indicator

6. LANDOWNER DASHBOARD (jika role="landowner")
- Tambah/edit tempat parkir
- Upload multiple gambar
- Set tarif dan jumlah slot
- Monitor booking aktif
- Lihat pendapatan

GRAPHQL OPERATIONS YANG TERSEDIA:

1. AUTH QUERIES & MUTATIONS:
```graphql
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    token
    user { _id, email, name, role }
  }
}

mutation Login($input: LoginInput!) {
  login(input: $input) {
    token
    user { _id, email, name, role, saldo }
  }
}

mutation GoogleAuth($token: String!) {
  googleAuth(token: $token) {
    token
    user { _id, name, email, avatar }
  }
}

query Me {
  me {
    _id, email, name, role, saldo, avatar, isEmailVerified, createdAt
  }
}

PARKING QUERIES & MUTATIONS:

query SearchParkingLots($lat: Float!, $lng: Float!, $radius: Float, $vehicleType: String, $minPrice: Float, $maxPrice: Float) {
  searchParkingLots(lat: $lat, lng: $lng, radius: $radius, vehicleType: $vehicleType, minPrice: $minPrice, maxPrice: $maxPrice) {
    _id, name, address, photos, availableSlots, tariff, rating, distance
  }
}

query GetParkingLot($id: ID!) {
  getParkingLot(id: $id) {
    _id, name, address, description, photos, location { coordinates }, availableSlots, totalSlots, vehicleTypes, tariff, operationalHours { open, close }, facilities, rating
  }
}

mutation CreateParking($input: CreateParkingInput!) {
  createParking(input: $input) {
    _id, name, address
  }
}

BOOKING QUERIES & MUTATIONS:
mutation CreateBooking($input: CreateBookingInput!) {
  createBooking(input: $input) {
    _id, startTime, duration, cost, status
  }
}

mutation GenerateBookingQR($bookingId: ID!) {
  generateBookingQR(bookingId: $bookingId) {
    _id, qrCode, entryQR, exitQR
  }
}

query GetMyActiveBookings {
  getMyActiveBookings {
    _id, startTime, duration, cost, status, qrCode, entryQR, exitQR
  }
}

query GetMyBookingHistory {
  getMyBookingHistory {
    _id, startTime, duration, cost, status
  }
}

PAYMENT QUERIES & MUTATIONS:
mutation CreatePayment($input: CreatePaymentInput!) {
  createPayment(input: $input) {
    _id, amount, paymentMethod, status, paymentUrl
  }
}

mutation TopUpSaldo($input: TopUpInput!) {
  topUpSaldo(input: $input) {
    _id, amount, paymentUrl
  }
}

query GetMyPaymentHistory {
  getMyPaymentHistory {
    _id, amount, paymentMethod, status, createdAt
  }
}
CHAT QUERIES & MUTATIONS:
query GetRoomMessages($roomId: ID!, $limit: Int) {
  getRoomMessages(room_id: $roomId, limit: $limit) {
    _id, message, user_id, createdAt
  }
}

mutation SendMessage($input: SendMessageInput!) {
  sendMessage(input: $input) {
    _id, message, createdAt
  }
}

subscription MessageReceived($roomId: ID!) {
  messageReceived(room_id: $roomId) {
    _id, message, sender { name, avatar }, createdAt
  }
}

REALTIME SUBSCRIPTIONS:
subscription BookingStatusChanged($parkingId: ID!) {
  bookingStatusChanged(parking_id: $parkingId) {
    _id, status, updatedAt
  }
}

subscription NotificationReceived {
  notificationReceived {
    _id, type, title, message, data, createdAt
  }
}

ERROR HANDLING:

Implementasikan error handling untuk setiap GraphQL error dengan kode:
UNAUTHENTICATED - Token tidak valid/expired
FORBIDDEN - Tidak punya akses
NOT_FOUND - Data tidak ditemukan
BAD_REQUEST - Input tidak valid
PAYMENT_FAILED - Gagal melakukan pembayaran
RESPONSIVE DESIGN:

Aplikasi harus responsif untuk mobile (375px) hingga desktop (1440px)
Implementasikan mobile-first approach
TOLONG GENERATE:

Struktur project Next.js dengan semua komponen dan pages yang diperlukan
Setup Apollo Client dengan autentikasi dan WebSocket
Implementasi fitur utama berdasarkan spec di atas (mulai dari satu fitur terlebih dahulu)
Contoh hooks dan components reusable untuk GraphQL operations
Layout dan UI components dengan Tailwind
Terima kasih, Copilot!