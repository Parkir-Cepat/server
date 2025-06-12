import { GraphQLScalarType, Kind, GraphQLError } from 'graphql';

// Create JSON scalar type
const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON custom scalar type',
  serialize(value) {
    if (typeof value === 'object' || Array.isArray(value)) {
      return value;
    }
    throw new GraphQLError('JSON must be an object or array');
  },
  parseValue(value) {
    if (typeof value === 'object' || Array.isArray(value)) {
      return value;
    }
    throw new GraphQLError('JSON must be an object or array');
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.OBJECT) {
      return ast.value;
    }
    if (ast.kind === Kind.LIST) {
      return ast.values.map(value => value.value);
    }
    throw new GraphQLError('JSON must be an object or array');
  }
});

export default {
  JSON: JSONScalar,

  Query: {
    // Add your notification queries here
  },

  Mutation: {
    // Add your notification mutations here
  },

  Subscription: {
    // Add your notification subscriptions here
  }
};
