import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql } from 'graphql';
import notificationResolvers from "../../../schemas/resolvers/notificationResolvers";
import { notificationTypes } from "../../../schemas/typeDefs/notificationTypes";

describe('Notification Type Definitions', () => {
  let schema;

  beforeAll(() => {
    // Create a schema using the notificationTypes and resolvers
    schema = makeExecutableSchema({
      typeDefs: [notificationTypes],
      resolvers: notificationResolvers
    });
  });

  describe('JSON scalar type', () => {
    it('serializes objects correctly', async () => {
      const testObject = { key: 'value', nested: { foo: 'bar' } };
      
      const query = `
        query TestJSONScalar($data: JSON!) {
          _unused_: Boolean
          # This query doesn't do anything other than validate the JSON scalar
        }
      `;
      
      // The execution will validate that the variable is correctly processed
      const result = await graphql({
        schema,
        source: query,
        variableValues: { data: testObject }
      });
      
      // There should be no errors related to scalar validation
      expect(result.errors).toBeUndefined();
    });

    it('serializes arrays correctly', async () => {
      const testArray = [1, 2, { key: 'value' }];
      
      const query = `
        query TestJSONScalar($data: JSON!) {
          _unused_: Boolean
          # This query doesn't do anything other than validate the JSON scalar
        }
      `;
      
      const result = await graphql({
        schema,
        source: query,
        variableValues: { data: testArray }
      });
      
      expect(result.errors).toBeUndefined();
    });

    it('rejects non-object/array values', async () => {
      const testString = "This is a string, not an object or array";
      
      const query = `
        query TestJSONScalar($data: JSON!) {
          _unused_: Boolean
        }
      `;
      
      const result = await graphql({
        schema,
        source: query,
        variableValues: { data: testString }
      });
      
      // Should have validation errors
      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain('JSON');
    });
  });
});
