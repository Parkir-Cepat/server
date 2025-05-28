export const roomTypes = `#graphql
  type Room {
    _id: ID!
    name: String!
    type: String!
    parking_id: ID
    parking: Parking
    participants: [User!]!
    participant_count: Int!
    last_message: Chat
    created_at: String!
    updated_at: String!
  }

  type UserRoom {
    _id: ID!
    user_id: ID!
    user: User!
    room_id: ID!
    room: Room!
    joined_at: String!
    role: String!
  }

  input CreateRoomInput {
    name: String!
    type: String!
    parking_id: ID
    participant_ids: [ID!]
  }

  input JoinRoomInput {
    room_id: ID!
  }

  type Query {
    getRoom(id: ID!): Room!
    getMyRooms: [Room!]!
    getRoomParticipants(room_id: ID!): [UserRoom!]!
    getParkingRooms(parking_id: ID!): [Room!]!
  }
  type Mutation {
    createRoom(input: CreateRoomInput!): Room!
    joinRoom(input: JoinRoomInput!): Room!
    leaveRoom(room_id: ID!): Boolean!
    addParticipants(room_id: ID!, participant_ids: [ID!]!): Room!
    removeParticipant(room_id: ID!, user_id: ID!): Room!
    updateRoom(room_id: ID!, name: String): Room!
    deleteRoom(id: ID!): Boolean!
  }

  type Subscription {
    roomUpdated(room_id: ID!): Room!
    roomParticipantJoined(room_id: ID!): UserRoom!
    roomParticipantLeft(room_id: ID!): UserRoom!
  }
`;
