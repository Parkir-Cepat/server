export const typeDefs = `#graphql
  type User {
    id: ID!
    email: String!
    name: String!
    role: String!
  }
  type Parking {
    id: ID!
    name: String!
    location: Point!
    availableSlots: Int!
    totalSlots: Int!
    tariff: Float!
  }
  type Booking {
    id: ID!
    userId: ID!
    parkingId: ID!
    startTime: String!
    duration: Int!
    cost: Float!
    status: String!
  }
  type Payment {
    id: ID!
    transactionId: String!
    paymentMethod: String!
    amount: Float!
    status: String!
  }
  type Point {
    lat: Float!
    lng: Float!
  }
  type Query {
    nearbyParkings(lat: Float!, lng: Float!, radius: Float!): [Parking!]!
    hello: String
  }
  type Mutation {
    createPayment(bookingId: ID!, paymentMethod: String!): Payment!
  }
  type Subscription {
    parkingAvailabilityChanged(parkingId: ID!): Parking!
  }
`;

export const resolvers = {
  Query: {
    hello: () => "Hello, ParkirCepat!",
    nearbyParkings: async (_, { lat, lng, radius }, { db }) => {
      const parkings = await db
        .collection("parkings")
        .aggregate([
          {
            $geoNear: {
              near: { type: "Point", coordinates: [lng, lat] },
              distanceField: "distance",
              maxDistance: radius,
              spherical: true,
            },
          },
          { $limit: 10 },
        ])
        .toArray();
      return parkings.map((p) => ({
        id: p._id,
        name: p.name,
        location: {
          lat: p.location.coordinates[1],
          lng: p.location.coordinates[0],
        },
        availableSlots: p.availableSlots,
        totalSlots: p.totalSlots,
        tariff: p.tariff,
      }));
    },
  },
  Mutation: {
    createPayment: async (_, { bookingId, paymentMethod }, { db, redis }) => {
      const booking = await db
        .collection("bookings")
        .findOne({ _id: new ObjectId(bookingId) });
      if (!booking) throw new Error("Booking not found");
      const amount = booking.cost;
      const transactionId = "TXN_" + Date.now(); // Ganti dengan Midtrans API call
      const payment = {
        bookingId: new ObjectId(bookingId),
        transactionId,
        paymentMethod,
        amount,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = await db.collection("payments").insertOne(payment);
      await redis.publish(
        "payment:updates",
        JSON.stringify({ transactionId, status: "pending" })
      );
      return {
        id: result.insertedId,
        transactionId,
        paymentMethod,
        amount,
        status: "pending",
      };
    },
  },
};

