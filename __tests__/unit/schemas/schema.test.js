import schema from '../../../schemas/schema.js';
import resolvers from '../../../schemas/resolvers.js';
import { GraphQLSchema } from 'graphql';

// Mock ../../utils/auth to resolve import issue
jest.mock('../../utils/auth', () => ({
  ensureAuth: jest.fn(() => true),
}));

describe('GraphQL Schema', () => {
  it('exports a GraphQLSchema instance', () => {
    expect(schema).toBeInstanceOf(GraphQLSchema);
  });

  it('resolvers match schema root types', () => {
    const typeMap = schema.getTypeMap();
    // check Query and Mutation types exist
    expect(typeMap.Query).toBeDefined();
    expect(resolvers.Query).toBeDefined();
    expect(typeMap.Mutation).toBeDefined();
    expect(resolvers.Mutation).toBeDefined();
  });
});
