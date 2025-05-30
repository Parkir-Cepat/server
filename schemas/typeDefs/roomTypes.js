export const roomTypes = `#graphql
  type Room {
    _id: ID!
    name: String!
    type: String!
    privacy: String!
    creator_id: ID!
    creator: User!
    max_participants: Int
    parking_id: ID
    parking: Parking
    participants: [User!]!
    participant_count: Int!
    is_full: Boolean!
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

  type Query {
    getRoom(id: ID!): Room!
    getMyRooms: [Room!]!
    getPublicRooms(limit: Int, parking_id: ID): [Room!]!
    getPrivateRoomWithUser(user_id: ID!, parking_id: ID): Room
    getRoomParticipants(room_id: ID!): [UserRoom!]!
    getParkingRooms(parking_id: ID!): [Room!]!
  }
  type Mutation {
    createRoom(input: CreateRoomInput!): Room!
    createPrivateRoom(input: CreatePrivateRoomInput!): Room!
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
