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
        origin: function(origin, callback) {
          const allowedOrigins = ['http://localhost:3000', 'http://localhost:5173'];
          if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
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
        console.log('🔔 Webhook Midtrans received:', JSON.stringify(req.body, null, 2));
        
        const notification = req.body;
        const { orderId, status } = await verifyNotification(notification);
        
        console.log(`📋 Processing order: ${orderId}, status: ${status}`);

        // Update status pembayaran berdasarkan tipe order
        if (orderId.startsWith('ORD-')) {
          // Update status pembayaran booking
          console.log('💳 Updating booking payment status...');
          await Payment.updateStatusByTransactionId(orderId, status);
        } else if (orderId.startsWith('TOP-')) {
          console.log('💰 Processing top-up transaction...');
          
          // Ambil transaksi saldo sebelum update
          const trx = await SaldoTransaction.findByTransactionId(orderId);
          console.log('📊 Found transaction:', trx ? `ID: ${trx._id}, Status: ${trx.status}, Amount: ${trx.amount}` : 'Not found');
          
          if (trx) {
            // Update status transaksi
            const updated = await SaldoTransaction.updateStatusByTransactionId(orderId, status);
            console.log('✅ Transaction status updated:', updated ? 'Success' : 'Failed');
            
            // Jika status success, update saldo user
            if (status === 'success' && trx.status !== 'success') {
              console.log(`💵 Adding ${trx.amount} to user ${trx.userId} balance...`);
              const { User } = await import('./models/User.js');
              const userUpdate = await User.updateSaldo(trx.userId, trx.amount);
              console.log('👤 User saldo updated:', userUpdate ? 'Success' : 'Failed');
            } else {
              console.log(`⚠️ Skipping saldo update. Status: ${status}, Previous status: ${trx.status}`);
            }
          } else {
            console.log('❌ Transaction not found for orderId:', orderId);
          }
        }

        console.log('✅ Webhook processed successfully');
        res.status(200).json({ status: 'success' });
      } catch (error) {
        console.error('❌ Error handling Midtrans webhook:', error);
        res.status(500).json({ status: 'error', message: error.message });
      }
    });

    // Endpoint untuk testing webhook secara manual
    app.post('/test-webhook', async (req, res) => {
      try {
        const { orderId } = req.body;
        console.log('🧪 Testing webhook for orderId:', orderId);
        
        // Simulasi payload webhook Midtrans
        const mockNotification = {
          order_id: orderId,
          transaction_status: 'settlement',
          payment_type: 'gopay',
          transaction_id: 'test-' + Date.now()
        };
        
        // Panggil logika webhook yang sama
        const { orderId: processedOrderId, status } = { orderId: mockNotification.order_id, status: 'success' };
        
        if (processedOrderId.startsWith('TOP-')) {
          const trx = await SaldoTransaction.findByTransactionId(processedOrderId);
          console.log('📊 Found transaction:', trx ? `ID: ${trx._id}, Status: ${trx.status}, Amount: ${trx.amount}` : 'Not found');
          
          if (trx) {
            const updated = await SaldoTransaction.updateStatusByTransactionId(processedOrderId, status);
            console.log('✅ Transaction status updated:', updated ? 'Success' : 'Failed');
            
            if (status === 'success' && trx.status !== 'success') {
              console.log(`💵 Adding ${trx.amount} to user ${trx.userId} balance...`);
              const { User } = await import('./models/User.js');
              const userUpdate = await User.updateSaldo(trx.userId, trx.amount);
              console.log('👤 User saldo updated:', userUpdate ? 'Success' : 'Failed');
            }
          }
        }
        
        res.status(200).json({ 
          status: 'success', 
          message: 'Test webhook completed',
          orderId: processedOrderId 
        });
      } catch (error) {
        console.error('❌ Error in test webhook:', error);
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
