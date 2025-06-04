const { print } = require('graphql');

// Import ES modules in CommonJS using dynamic import workaround
let typeDefs, resolvers;

beforeAll(async () => {
  const typeDefsModule = await import('../../../schemas/typeDefs/index.js');
  const resolversModule = await import('../../../schemas/resolvers/index.js');
  
  typeDefs = typeDefsModule.default;
  resolvers = resolversModule.default;
});

describe('GraphQL Schema Integration', () => {
  test('should export valid typeDefs', () => {
    expect(typeof typeDefs).toBe('object'); // GraphQL AST is an object
    expect(typeDefs).toHaveProperty('kind', 'Document');
    expect(typeDefs).toHaveProperty('definitions');
    expect(Array.isArray(typeDefs.definitions)).toBe(true);
    expect(typeDefs.definitions.length).toBeGreaterThan(0);
  });

  test('should export valid resolvers', () => {
    expect(typeof resolvers).toBe('object');
    expect(resolvers).toHaveProperty('Query');
    expect(resolvers).toHaveProperty('Mutation');
  });

  test('typeDefs should contain User types', () => {
    const typeDefsString = print(typeDefs);
    expect(typeDefsString).toContain('type User');
    expect(typeDefsString).toContain('email');
    expect(typeDefsString).toContain('role');
  });

  test('typeDefs should contain Parking types', () => {
    const typeDefsString = print(typeDefs);
    expect(typeDefsString).toContain('type Parking');
    expect(typeDefsString).toContain('name');
    expect(typeDefsString).toContain('address');
  });

  test('typeDefs should contain Booking types', () => {
    const typeDefsString = print(typeDefs);
    expect(typeDefsString).toContain('type Booking');
    expect(typeDefsString).toContain('user_id');
    expect(typeDefsString).toContain('parking_id');
  });

  test('typeDefs should contain Transaction types', () => {
    const typeDefsString = print(typeDefs);
    expect(typeDefsString).toContain('type Transaction');
    expect(typeDefsString).toContain('amount');
    expect(typeDefsString).toContain('status');
  });

  test('resolvers should have Query resolvers', () => {
    expect(typeof resolvers.Query).toBe('object');
    expect(resolvers.Query).toHaveProperty('me');
    expect(resolvers.Query).toHaveProperty('getNearbyParkings');
    expect(resolvers.Query).toHaveProperty('getBooking');
  });

  test('resolvers should have Mutation resolvers', () => {
    expect(typeof resolvers.Mutation).toBe('object');
    expect(resolvers.Mutation).toHaveProperty('register');
    expect(resolvers.Mutation).toHaveProperty('login');
  });

  test('should contain subscription types if available', () => {
    const typeDefsString = print(typeDefs);
    if (typeDefsString.includes('type Subscription')) {
      expect(resolvers).toHaveProperty('Subscription');
    }
  });
});
