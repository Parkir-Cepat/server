export const parkingLotTypes = `#graphql
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

  type ParkingLot {
    _id: ID!
    name: String!
    address: String!
    location: Location!
    ownerId: ID!
    owner: User
    capacity: Capacity!
    available: Available!
    rates: Rates!
    operationalHours: OperationalHours!
    facilities: [String!]!
    images: [String!]!
    status: String!
    rating: Float!
    reviewCount: Int!
    createdAt: String!
    updatedAt: String!
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

  input CreateParkingLotInput {
    name: String!
    address: String!
    location: LocationInput!
    capacity: CapacityInput!
    rates: RatesInput!
    operationalHours: OperationalHoursInput!
    facilities: [String!]!
    images: [String!]!
  }

  input UpdateParkingLotInput {
    name: String
    address: String
    rates: RatesInput
    operationalHours: OperationalHoursInput
    facilities: [String!]
    images: [String!]
    status: String
  }

  type Query {
    getParkingLot(id: ID!): ParkingLot!
    getNearbyParkingLots(
      longitude: Float!
      latitude: Float!
      maxDistance: Float
      vehicleType: String
    ): [ParkingLot!]!
    getMyParkingLots: [ParkingLot!]!
    searchParkingLots(
      query: String!
      vehicleType: String
      sortBy: String
    ): [ParkingLot!]!
  }

  type Mutation {
    createParkingLot(input: CreateParkingLotInput!): ParkingLot!
    updateParkingLot(id: ID!, input: UpdateParkingLotInput!): ParkingLot!
    deleteParkingLot(id: ID!): Boolean!
    addParkingLotImage(id: ID!, imageUrl: String!): ParkingLot!
    removeParkingLotImage(id: ID!, imageUrl: String!): ParkingLot!
    updateParkingLotRating(id: ID!, rating: Float!): ParkingLot!
  }
`; 