/**
 * Creates a mock GraphQL context for testing
 * @param {Object} options - Options to customize the mock context
 * @param {Object} [options.user] - The user object to include in the context
 * @param {Object} [options.pubsub] - A mock pubsub instance
 * @param {boolean} [options.isAdmin] - Whether the user has admin role
 * @returns {Object} A mocked context object
 */
export const createMockContext = ({ user = null, pubsub = null, isAdmin = false } = {}) => {
  const mockUser = user || {
    _id: '60d0fe4f5311236168a109ca',
    username: 'testuser',
    email: 'test@example.com',
    role: isAdmin ? 'admin' : 'user',
    saldo: 10000
  };

  const mockPubSub = pubsub || {
    publish: jest.fn(),
    asyncIterator: jest.fn().mockReturnValue({
      async* [Symbol.asyncIterator]() {
        yield { data: 'test' };
      }
    })
  };

  return {
    user: mockUser,
    pubsub: mockPubSub
  };
};

/**
 * Creates a mock for database models
 * @param {Object} options - Mock configuration options 
 * @returns {Object} An object with mocked model methods
 */
export const createMockModel = ({
  findByIdResult = {},
  findAllResult = [],
  createResult = {},
  updateResult = {},
  deleteResult = true,
  customMethods = {}
} = {}) => {
  const model = {
    findById: jest.fn().mockResolvedValue(findByIdResult),
    findAll: jest.fn().mockResolvedValue(findAllResult),
    create: jest.fn().mockResolvedValue(createResult),
    update: jest.fn().mockResolvedValue(updateResult),
    delete: jest.fn().mockResolvedValue(deleteResult),
    ...customMethods
  };
  
  return model;
};

/**
 * Creates a mock for GraphQL errors
 */
export class MockGraphQLError extends Error {
  constructor(message, extensions = {}) {
    super(message);
    this.name = 'GraphQLError';
    this.extensions = extensions;
  }
}

/**
 * Creates mock request and response objects for testing
 */
export const createMockReqRes = () => {
  const req = {
    headers: {},
    body: {},
    cookies: {},
    query: {},
    params: {}
  };
  
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis()
  };
  
  return { req, res };
};

/**
 * Creates mocks for MongoDB objects 
 */
export const createMockMongoDb = () => {
  const mockCollection = {
    findOne: jest.fn(),
    find: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue([]),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis()
    }),
    insertOne: jest.fn().mockResolvedValue({ insertedId: 'mock-id' }),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    countDocuments: jest.fn().mockResolvedValue(0),
    createIndex: jest.fn(),
    aggregate: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue([])
    })
  };

  const mockDb = {
    collection: jest.fn().mockReturnValue(mockCollection)
  };

  return { mockCollection, mockDb };
};
