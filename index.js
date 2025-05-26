import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { createServer } from 'http';
import express from 'express';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { makeExecutableSchema } from '@graphql-tools/schema';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { authContext } from './helpers/jwt.js';
import typeDefs from './schemas/typeDefs/index.js';
import resolvers from './schemas/resolvers/index.js';
import { verifyNotification } from './helpers/midtrans.js';
import { Payment } from './models/Payment.js';
import { SaldoTransaction } from './models/SaldoTransaction.js';
import session from 'express-session';
import passport from './helpers/googleAuth.js';


// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Create HTTP server
const httpServer = createServer(app);

// Create WebSocket server
const wsServer = new WebSocketServer({
  server: httpServer,
  path: process.env.WS_PATH || '/graphql',
});

// Create GraphQL schema
const schema = makeExecutableSchema({ typeDefs, resolvers });

// Set up WebSocket server
const serverCleanup = useServer(
  {
    schema,
    context: async (ctx) => {
      return await authContext({ connection: ctx.connectionParams });
    },
  },
  wsServer
);

// Create Apollo Server
const server = new ApolloServer({
  schema,
  plugins: [
    // Proper shutdown for the HTTP server
    ApolloServerPluginDrainHttpServer({ httpServer }),
    // Proper shutdown for the WebSocket server
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start Apollo Server
    await server.start();

    // Apply middleware
    app.use(
      cors({
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
      })
    );
    app.use(express.json());

    // Setup session
    app.use(
      session({
        secret: process.env.SESSION_SECRET || 'your-secret-key',
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: process.env.NODE_ENV === 'production',
          maxAge: 24 * 60 * 60 * 1000 // 24 jam
        }
      })
    );

    // Initialize Passport
    app.use(passport.initialize());
    app.use(passport.session());

    // Google OAuth routes
    app.get('/auth/google',
      passport.authenticate('google', { 
        scope: ['profile', 'email'],
        session: false 
      })
    );

    app.get('/auth/google/callback',
      passport.authenticate('google', { 
        session: false,
        failureRedirect: process.env.CLIENT_URL + '/login?error=google-auth-failed'
      }),
      (req, res) => {
        const token = generateGoogleAuthToken(req.user);
        res.redirect(process.env.CLIENT_URL + `/login?token=${token}`);
      }
    );

    // GraphQL endpoint
    app.use(
      '/graphql',
      expressMiddleware(server, {
        context: async ({ req }) => {
          return await authContext({ req });
        },
      })
    );

    // Webhook endpoint untuk notifikasi Midtrans
    app.post('/midtrans-webhook', async (req, res) => {
      try {
        const notification = req.body;
        const { orderId, status, transactionId } = await verifyNotification(notification);

        // Update status pembayaran berdasarkan tipe order
        if (orderId.startsWith('ORD-')) {
          // Update status pembayaran booking
          await Payment.updateStatus(transactionId, status);
        } else if (orderId.startsWith('TOP-')) {
          // Update status top up saldo
          await SaldoTransaction.updateStatus(transactionId, status);
        }

        res.status(200).json({ status: 'success' });
      } catch (error) {
        console.error('Error handling Midtrans webhook:', error);
        res.status(500).json({ status: 'error', message: error.message });
      }
    });

    // Start HTTP server
    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => {
      console.log(`
🚀 Server siap di http://localhost:${PORT}/graphql
🔌 WebSocket siap di ws://localhost:${PORT}${process.env.WS_PATH || '/graphql'}
      `);
    });
  } catch (error) {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  }
};

startServer();
