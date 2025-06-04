// Integration tests for Booking, Transaction, and User flows
// This file will cover booking creation, payment, status updates, and error handling

import request from 'supertest';
import { createTestUser, createTestParkingLot, createTestBooking, cleanupDatabase } from '../utils/testHelpers';
import { CREATE_BOOKING, CANCEL_BOOKING, GET_USER_BOOKINGS } from '../utils/graphqlQueries';

// Assume app is exported from server entry (e.g., server/app.js)
const { app } = require('../../index.js');

let testUser, testParking, testBooking;

beforeAll(async () => {
  // Setup test user and parking lot
  testUser = await createTestUser();
  testParking = await createTestParkingLot();
});

afterAll(async () => {
  // Cleanup test DB
  await cleanupDatabase();
});

describe('Booking Integration', () => {
  it('should create a booking successfully', async () => {
    const bookingInput = {
      parking_id: testParking._id,
      vehicle_type: 'car',
      start_time: new Date().toISOString(),
      duration: 2
    };
    const res = await request(app)
      .post('/graphql')
      .send({
        query: CREATE_BOOKING,
        variables: { input: bookingInput }
      })
      .set('Authorization', `Bearer ${testUser.token}`);
    expect(res.body.data?.createBooking).toHaveProperty('_id');
    expect(res.body.data?.createBooking?.status).toBe('pending');
    testBooking = res.body.data?.createBooking;
    expect(res.body.errors).toBeUndefined();
  });

  it('should get user bookings', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({ query: GET_USER_BOOKINGS })
      .set('Authorization', `Bearer ${testUser.token}`);
    expect(res.body.data?.getUserBookings?.length).toBeGreaterThan(0);
    expect(res.body.errors).toBeUndefined();
  });

  it('should cancel a booking', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({
        query: CANCEL_BOOKING,
        variables: { id: testBooking._id }
      })
      .set('Authorization', `Bearer ${testUser.token}`);
    expect(res.body.data?.cancelBooking?.status).toBe('cancelled');
    expect(res.body.errors).toBeUndefined();
  });

  it('should handle booking creation with invalid duration', async () => {
    const bookingInput = {
      parking_id: testParking._id,
      vehicle_type: 'car',
      start_time: new Date().toISOString(),
      duration: 0
    };
    const res = await request(app)
      .post('/graphql')
      .send({
        query: CREATE_BOOKING,
        variables: { input: bookingInput }
      })
      .set('Authorization', `Bearer ${testUser.token}`);
    expect(res.body.errors?.[0]?.message).toMatch(/Durasi parkir minimal/);
  });
});
