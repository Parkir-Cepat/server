import { GraphQLError, Kind } from 'graphql';
import notificationResolvers from "../../../schemas/resolvers/notificationResolvers.js";

describe('Notification Resolvers', () => {
  describe('JSONScalar', () => {
    const JSONScalar = notificationResolvers.JSON;
    
    describe('serialize', () => {
      it('should return objects as is', () => {
        const testObject = { key: 'value' };
        expect(JSONScalar.serialize(testObject)).toBe(testObject);
      });
      
      it('should return arrays as is', () => {
        const testArray = [1, 2, 3];
        expect(JSONScalar.serialize(testArray)).toBe(testArray);
      });
    });
    
    describe('parseValue', () => {
      it('should return objects as is', () => {
        const testObject = { key: 'value' };
        expect(JSONScalar.parseValue(testObject)).toBe(testObject);
      });
      
      it('should return arrays as is', () => {
        const testArray = [1, 2, 3];
        expect(JSONScalar.parseValue(testArray)).toBe(testArray);
      });
    });
    
    describe('parseLiteral', () => {
      it('should handle OBJECT AST nodes', () => {
        const objectNode = {
          kind: Kind.OBJECT,
          value: { key: 'value' }
        };
        
        expect(JSONScalar.parseLiteral(objectNode)).toEqual({ key: 'value' });
      });
      
      it('should handle LIST AST nodes', () => {
        const listNode = {
          kind: Kind.LIST,
          values: [
            { value: 1 },
            { value: 2 },
            { value: 3 }
          ]
        };
        
        expect(JSONScalar.parseLiteral(listNode)).toEqual([1, 2, 3]);
      });
      
      it('should throw GraphQLError for unsupported AST node kinds', () => {
        const stringNode = {
          kind: Kind.STRING,
          value: 'test'
        };
        
        expect(() => JSONScalar.parseLiteral(stringNode)).toThrow(GraphQLError);
      });
    });
  });
  
  // Even though the resolver doesn't have much functionality,
  // testing the structure ensures we know if something changes
  describe('Resolver structure', () => {
    it('should have Query property', () => {
      expect(notificationResolvers).toHaveProperty('Query');
      expect(typeof notificationResolvers.Query).toBe('object');
    });
    
    it('should have Mutation property', () => {
      expect(notificationResolvers).toHaveProperty('Mutation');
      expect(typeof notificationResolvers.Mutation).toBe('object');
    });
    
    it('should have Subscription property', () => {
      expect(notificationResolvers).toHaveProperty('Subscription');
      expect(typeof notificationResolvers.Subscription).toBe('object');
    });
  });
});


