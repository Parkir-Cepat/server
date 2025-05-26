export const notificationTypes = `#graphql
  type Notification {
    _id: ID!
    userId: ID!
    type: String!
    title: String!
    message: String!
    data: JSON
    isRead: Boolean!
    createdAt: String!
  }

  type Query {
    getMyNotifications(limit: Int): [Notification!]!
    getUnreadNotificationCount: Int!
  }

  type Mutation {
    markNotificationAsRead(id: ID!): Boolean!
    markAllNotificationsAsRead: Boolean!
  }

  type Subscription {
    notificationReceived: Notification!
  }

  scalar JSON
`; 