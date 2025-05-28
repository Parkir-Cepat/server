export const chatTypes = `#graphql
  type Chat {
    _id: ID!
    sender_id: ID!
    sender: User!
    room_id: ID!
    room: Room!
    message: String!
    message_type: String!
    read_by: [ID!]!
    created_at: String!
    updated_at: String!
  }

  input SendMessageInput {
    room_id: ID!
    message: String!
    message_type: String
  }

  type MessageStatus {
    message_id: ID!
    read_by: [ID!]!
    delivered_to: [ID!]!
  }
  type Query {
    getRoomMessages(room_id: ID!, limit: Int, offset: Int): [Chat!]!
    getUnreadMessages(room_id: ID): [Chat!]!
    getMessageStatus(message_id: ID!): MessageStatus!
    getMyRecentChats: [Chat!]!
  }

  type Mutation {
    sendMessage(input: SendMessageInput!): Chat!
    markMessageAsRead(message_id: ID!): Chat!
    markRoomMessagesAsRead(room_id: ID!): Boolean!
    deleteMessage(message_id: ID!): Boolean!
    editMessage(message_id: ID!, new_message: String!): Chat!
  }

  type Subscription {
    messageReceived(room_id: ID!): Chat!
    messageRead(room_id: ID!): Chat!
    messageDeleted(room_id: ID!): ID!
    messageEdited(room_id: ID!): Chat!
  }
`;