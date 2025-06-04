import { ApolloServer } from 'apollo-server-express';
import { makeExecutableSchema } from '@graphql-tools/schema';
import typeDefs from '../../schemas/typeDefs/index.js';
import resolvers from '../../schemas/resolvers/index.js';

export const createTestServer = (contextOverride = {}) => {
  const schema = makeExecutableSchema({
    typeDefs,
    resolvers
  });

  return new ApolloServer({
    schema,
    context: ({ req }) => ({
      req,
      ...contextOverride
    }),
    introspection: true
  });
};

export const executeTestQuery = async (server, query, variables = {}, context = {}) => {
  return await server.executeOperation({
    query,
    variables
  }, {
    contextValue: context
  });
};