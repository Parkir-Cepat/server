export const userTypes = `#graphql
  type User {
    _id: ID!
    email: String!
    name: String!
    role: String!
    saldo: Float!
    created_at: String!
    updated_at: String!
    google_id: String
    avatar: String
    is_email_verified: Boolean
    last_login: String
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type DashboardStats {
    totalParkingLots: Int!
    parkingLotsChange: Float!
    monthlyEarnings: Float!
    earningsChange: Float!
    activeBookings: Int!
    bookingsChange: Float!
    totalUsers: Int!
    usersChange: Float!
    platformRevenue: Float!
    revenueChange: Float!
    pendingApprovals: Int!
    totalBookings: Int!
    totalSpent: Float!
    spentChange: Float!
    walletChange: Float!
  }

  type RecentActivity {
    id: String!
    type: String!
    title: String!
    description: String!
    timestamp: String!
    location: String
    bookingId: String
    parkingId: String
    chatId: String
  }

  input RegisterInput {
    email: String!
    password: String!
    name: String!
    role: String
  }

  input LoginInput {
    email: String!
    password: String!
  }

  type Query {
    me: User
    getUserById(userId: ID!): User
    getUsersByRole(role: String!): [User!]!
    getDashboardStats: DashboardStats!
    getRecentActivity(limit: Int): [RecentActivity!]!
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    updateProfile(name: String!): User!
    changePassword(oldPassword: String!, newPassword: String!): Boolean!
    googleAuth(token: String!): AuthPayload!
  }
`;
