import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';
import express from 'express';
import cors from 'cors';
import { connectDB } from '../../config/db.js';
import { authContext } from '../../helpers/jwt.js';
import typeDefs from '../../schemas/typeDefs/index.js';
import resolvers from '../../schemas/resolvers/index.js';

let testServer;
let apolloServer;

export const createTestServer = async () => {
  if (testServer) {
    return testServer;
  }

  // Create Express app
  const app = express();
  
  // Disable x-powered-by header
  app.disable('x-powered-by');

  // Create GraphQL schema
  const schema = makeExecutableSchema({ typeDefs, resolvers });

  // Create Apollo Server
  apolloServer = new ApolloServer({
    schema,
    introspection: true,
    plugins: []
  });

  // Connect to test database
  try {
    await connectDB();
  } catch (error) {
    // Database might already be connected in tests
    console.log('Database connection handled by test setup');
  }

  // Start Apollo Server
  await apolloServer.start();

  // Apply middleware
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  }));
  
  app.use(express.json());

  // GraphQL endpoint
  app.use(
    '/graphql',
    expressMiddleware(apolloServer, {
      context: async ({ req }) => {
        return await authContext({ req });
      },
    })
  );

  // Webhook endpoint untuk testing
  app.post('/midtrans-webhook', async (req, res) => {
    try {
      // Mock webhook handler for testing
      res.status(200).json({ status: 'success' });
    } catch (error) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  testServer = app;
  return app;
};

export const closeTestServer = async () => {
  if (apolloServer) {
    await apolloServer.stop();
    apolloServer = null;
  }
  testServer = null;
};

export const getTestServer = () => {
  if (!testServer) {
    throw new Error('Test server not initialized. Call createTestServer() first.');
  }
  return testServer;
}; 