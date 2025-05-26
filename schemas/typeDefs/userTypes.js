export const userTypes = `#graphql
  type User {
    _id: ID!
    email: String!
    name: String!
    role: String!
    saldo: Float!
    createdAt: String!
    googleId: String
    avatar: String
    isEmailVerified: Boolean
    lastLogin: String
  }

  type AuthPayload {
    token: String!
    user: User!
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
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    updateProfile(name: String!): User!
    changePassword(oldPassword: String!, newPassword: String!): Boolean!
    googleAuth(token: String!): AuthPayload!
  }
`; 