// Simple integration test for server entry point
describe('Server Entry Point (index.js)', () => {
  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  test('should export required modules for testing', () => {
    const indexModule = require('../../index.js');
    
    expect(indexModule).toHaveProperty('app');
    expect(indexModule).toHaveProperty('server');  
    expect(indexModule).toHaveProperty('httpServer');
  });

  test('should have environment variables configured', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  test('should import main dependencies without errors', () => {
    expect(() => {
      require('express');
      require('http');
      require('cors');
      require('@apollo/server');
    }).not.toThrow();
  });

  test('should import GraphQL dependencies without errors', () => {
    expect(() => {
      require('@graphql-tools/schema');
      require('graphql-ws/lib/use/ws');
    }).not.toThrow();
  });

  test('should import project dependencies without errors', () => {
    expect(() => {
      require('../../config/db.js');
      require('../../helpers/jwt.js');
      require('../../schemas/typeDefs/index.js');
      require('../../schemas/resolvers/index.js');
    }).not.toThrow();
  });
});
