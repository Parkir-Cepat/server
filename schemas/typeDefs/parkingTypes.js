export const parkingTypes = `#graphql
  type Location {
    type: String!
    coordinates: [Float!]!
  }

  type Capacity {
    car: Int!
    motorcycle: Int!
  }

  type Available {
    car: Int!
    motorcycle: Int!
  }

  type Rates {
    car: Float!
    motorcycle: Float!
  }

  type OperationalHours {
    open: String!
    close: String!
  }

  type Parking {
    _id: ID!
    name: String!
    address: String!
    location: Location!
    owner_id: ID!
    owner: User
    capacity: Capacity!
    available: Available!
    rates: Rates!
    operational_hours: OperationalHours!
    facilities: [String!]!
    images: [String!]!
    status: String!
    rating: Float!
    review_count: Int!
    created_at: String!
    updated_at: String!
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

  input UpdateParkingInput {
    name: String
    address: String
    rates: RatesInput
    operational_hours: OperationalHoursInput
    facilities: [String!]
    images: [String!]
    status: String
  }

  type Query {
    getParking(id: ID!): Parking!
    getNearbyParkings(
      longitude: Float!
      latitude: Float!
      maxDistance: Float
      vehicleType: String
    ): [Parking!]!
    getMyParkings: [Parking!]!
    searchParkings(
      query: String!
      vehicleType: String
      sortBy: String
    ): [Parking!]!
  }
  type Mutation {
    createParking(input: CreateParkingInput!): Parking!
    updateParking(id: ID!, input: UpdateParkingInput!): Parking!
    deleteParking(id: ID!): Boolean!
    addParkingImage(id: ID!, imageUrl: String!): Parking!
    removeParkingImage(id: ID!, imageUrl: String!): Parking!
    updateParkingRating(id: ID!, rating: Float!): Parking!
    updateParkingAvailability(id: ID!, available_slots: Int!): Parking!
  }
`;
