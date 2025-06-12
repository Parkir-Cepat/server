export const chatTypes = `#graphql
  type Chat {
    _id: ID!
    user_id: ID!
    room_id: ID!
    message: String!
    message_type: String!
    read_by: [ID!]!
    created_at: String!
    updated_at: String!
    sender_id: ID! # Alias for user_id
    sender: User
    room: Room
  }

  input SendMessageInput {
    room_id: ID!
    message: String!
    message_type: String
  }

  input MarkRoomReadInput {
    room_id: ID!
  }

  type Query {
    getRoomMessages(room_id: ID!, limit: Int): [Chat!]!
    getMyRecentChats: [Chat!]!
    getUnreadCount: Int!
  }

  type Mutation {
    sendMessage(input: SendMessageInput!): Chat!
    markRoomMessagesAsRead(room_id: ID!): Boolean!
  }

  type Subscription {
    messageReceived(room_id: ID!): Chat!
    messageSent(room_id: ID!): Chat!
    roomMessageUpdate(user_id: ID!): Chat!
  }
`;
