export const notificationTypes = `#graphql
  type Notification {
    _id: ID!
    user_id: ID!
    type: String!
    title: String!
    message: String!
    data: JSON
    is_read: Boolean!
    created_at: String!
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