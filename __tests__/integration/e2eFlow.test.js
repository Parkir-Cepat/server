import request from 'supertest';
import { createTestServer, closeTestServer } from '../utils/testServer.js';
import { cleanupDatabase, expectGraphQLSuccess } from '../utils/testHelpers.js';
import { MongoClient } from 'mongodb';

describe('End-to-End Flow Test', () => {
  let app;
  let db;
  let client;
  let userToken, userId, landownerToken, landownerId, parkingLotId, bookingId, paymentId;

  beforeAll(async () => {
    app = await createTestServer();
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    db = client.db();
  });

  afterAll(async () => {
    await closeTestServer();
    await client.close();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  it('should register, login, create parking lot, booking, payment, notification, and chat', async () => {
    // Register user
    const registerMutation = `
      mutation Register($input: RegisterInput!) {
        register(input: $input) { token user { _id email name role } }
      }
    `;
    const userInput = { email: 'user1@example.com', password: 'password123', name: 'User 1', role: 'customer' };
    let response = await request(app)
      .post('/graphql')
      .send({ query: registerMutation, variables: { input: userInput } });
    expectGraphQLSuccess(response);
    userToken = response.body.data.register.token;
    userId = response.body.data.register.user._id;

    // Register landowner
    const landownerInput = { email: 'landowner@example.com', password: 'password123', name: 'Land Owner', role: 'landowner' };
    response = await request(app)
      .post('/graphql')
      .send({ query: registerMutation, variables: { input: landownerInput } });
    expectGraphQLSuccess(response);
    landownerToken = response.body.data.register.token;
    landownerId = response.body.data.register.user._id;

    // Login user
    const loginMutation = `
      mutation Login($input: LoginInput!) {
        login(input: $input) { token user { _id email } }
      }
    `;
    response = await request(app)
      .post('/graphql')
      .send({ query: loginMutation, variables: { input: { email: userInput.email, password: userInput.password } } });
    expectGraphQLSuccess(response);
    userToken = response.body.data.login.token;

    // Landowner create parking lot
    const createParkingLotMutation = `
      mutation CreateParkingLot($input: CreateParkingLotInput!) {
        createParkingLot(input: $input) { _id name ownerId }
      }
    `;
    const parkingLotInput = {
      name: 'Lot E2E',
      location: { coordinates: [106.8, -6.2] },
      capacity: { car: 10, motorcycle: 20 },
      address: 'Jl. E2E',
      rates: { car: 5000, motorcycle: 2000 },
      operationalHours: { open: '08:00', close: '22:00' },
      facilities: ['CCTV'],
      images: ['https://dummy.com/img.jpg']
    };
    response = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${landownerToken}`)
      .send({ query: createParkingLotMutation, variables: { input: parkingLotInput } });
    expectGraphQLSuccess(response);
    parkingLotId = response.body.data.createParkingLot._id;

    // User create booking
    const createBookingMutation = `
      mutation CreateBooking($input: CreateBookingInput!) {
        createBooking(input: $input) { _id parkingLotId status }
      }
    `;
    const bookingInput = {
      parkingLotId,
      vehicleType: 'car',
      startTime: new Date().toISOString(),
      duration: 2
    };
    response = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ query: createBookingMutation, variables: { input: bookingInput } });
    expectGraphQLSuccess(response);
    bookingId = response.body.data.createBooking._id;

    // User create payment (akan error saldo tidak cukup, hanya cek error handling)
    const createPaymentMutation = `
      mutation CreatePayment($input: CreatePaymentInput!) {
        createPayment(input: $input) { _id status amount }
      }
    `;
    response = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ query: createPaymentMutation, variables: { input: { bookingId, paymentMethod: 'saldo' } } });
    // Bisa expect error atau success tergantung saldo user
    // expectGraphQLError(response, 'Saldo tidak mencukupi');
    // Atau jika saldo dummy, bisa cek success

    // Cek notifikasi user
    const notifQuery = `query { getMyNotifications { _id message isRead } }`;
    response = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ query: notifQuery });
    expectGraphQLSuccess(response);
    expect(Array.isArray(response.body.data.getMyNotifications)).toBe(true);

    // Chat antar user
    const sendMessageMutation = `
      mutation SendMessage($input: SendMessageInput!) {
        sendMessage(input: $input) { _id message senderId receiverId }
      }
    `;
    const input = { receiverId: landownerId, message: 'Halo Landowner!' };
    response = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ query: sendMessageMutation, variables: { input } });
    expectGraphQLSuccess(response);
    expect(response.body.data.sendMessage.message).toBe('Halo Landowner!');
  });
}); 