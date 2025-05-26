export const chatTypes = `#graphql
  type Chat {
    _id: ID!
    senderId: ID!
    sender: User
    receiverId: ID!
    receiver: User
    bookingId: ID
    booking: Booking
    message: String!
    read: Boolean!
    createdAt: String!
  }

  type ChatParticipant {
    _id: ID!
    name: String!
    lastMessage: String
    lastMessageTime: String
    unreadCount: Int!
  }

  input SendMessageInput {
    receiverId: ID!
    message: String!
    bookingId: ID
  }

  type Query {
    getChatHistory(userId: ID!, limit: Int): [Chat!]!
    getBookingChats(bookingId: ID!): [Chat!]!
    getChatParticipants: [ChatParticipant!]!
    getUnreadMessages: [Chat!]!
  }

  type Mutation {
    sendMessage(input: SendMessageInput!): Chat!
    markMessageAsRead(messageId: ID!): Chat!
    markAllMessagesAsRead(senderId: ID!): Boolean!
  }

  type Subscription {
    messageReceived(userId: ID!): Chat!
    messageRead(userId: ID!): Chat!
  }
`; 