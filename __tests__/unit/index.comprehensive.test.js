import { jest } from '@jest/globals';

// Mock all external dependencies before importing the main file
jest.unstable_mockModule('@apollo/server', () => ({
  ApolloServer: jest.fn(() => ({
    start: jest.fn(),
    executeOperation: jest.fn()
  }))
}));

jest.unstable_mockModule('@apollo/server/express4', () => ({
  expressMiddleware: jest.fn()
}));

jest.unstable_mockModule('@apollo/server/plugin/drainHttpServer', () => ({
  ApolloServerPluginDrainHttpServer: jest.fn()
}));

jest.unstable_mockModule('http', () => ({
  createServer: jest.fn(() => ({
    listen: jest.fn((port, callback) => {
      if (callback) callback();
    })
  }))
}));

jest.unstable_mockModule('express', () => {
  const mockApp = {
    use: jest.fn(),
    get: jest.fn(),
    listen: jest.fn()
  };
  const express = jest.fn(() => mockApp);
  express.json = jest.fn();
  return { default: express };
});

jest.unstable_mockModule('ws', () => ({
  WebSocketServer: jest.fn()
}));

jest.unstable_mockModule('graphql-ws/lib/use/ws', () => ({
  useServer: jest.fn(() => ({
    dispose: jest.fn()
  }))
}));

jest.unstable_mockModule('@graphql-tools/schema', () => ({
  makeExecutableSchema: jest.fn(() => ({}))
}));

jest.unstable_mockModule('cors', () => ({
  default: jest.fn()
}));

jest.unstable_mockModule('dotenv', () => ({
  default: {
    config: jest.fn()
  }
}));

jest.unstable_mockModule('../../config/db.js', () => ({
  connectDB: jest.fn()
}));

jest.unstable_mockModule('../../helpers/jwt.js', () => ({
  authContext: jest.fn()
}));

jest.unstable_mockModule('../../schemas/typeDefs/index.js', () => ({
  default: 'type Query { hello: String }'
}));

jest.unstable_mockModule('../../schemas/resolvers/index.js', () => ({
  default: { Query: { hello: () => 'Hello World' } }
}));

jest.unstable_mockModule('../../helpers/midtrans.js', () => ({
  verifyNotification: jest.fn()
}));

jest.unstable_mockModule('../../models/Transaction.js', () => ({
  Transaction: {
    findByTransactionId: jest.fn()
  }
}));

jest.unstable_mockModule('express-session', () => ({
  default: jest.fn()
}));

jest.unstable_mockModule('../../helpers/googleAuth.js', () => ({
  default: {
    initialize: jest.fn(),
    session: jest.fn(),
    authenticate: jest.fn(() => (req, res, next) => next())
  }
}));

jest.unstable_mockModule('../../routes/webhook.js', () => ({
  default: {}
}));

// Mock generateGoogleAuthToken since it's used but not imported
global.generateGoogleAuthToken = jest.fn(() => 'mock-token');

// Mock process.env
const originalEnv = process.env;
beforeEach(() => {
  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    PORT: '3001',
    WS_PATH: '/graphql',
    SESSION_SECRET: 'test-secret',
    CLIENT_URL: 'http://localhost:3000',
    GOOGLE_MAPS_API_KEY: 'test-api-key'
  };
});

afterEach(() => {
  process.env = originalEnv;
  jest.clearAllMocks();
});

describe('Server Entry Point (index.js)', () => {
  let mockApolloServer;
  let mockHttpServer;
  let mockApp;
  let mockExpress;
  let consoleSpy;

  beforeEach(async () => {
    // Mock console methods
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(),
      error: jest.spyOn(console, 'error').mockImplementation()
    };

    // Get mocked modules
    const { ApolloServer } = await import('@apollo/server');
    const { createServer } = await import('http');
    const express = await import('express');
    
    mockApolloServer = {
      start: jest.fn(),
      executeOperation: jest.fn()
    };
    ApolloServer.mockReturnValue(mockApolloServer);

    mockHttpServer = {
      listen: jest.fn((port, callback) => {
        if (callback) callback();
      })
    };
    createServer.mockReturnValue(mockHttpServer);

    mockApp = {
      use: jest.fn(),
      get: jest.fn(),
      listen: jest.fn()
    };
    express.default.mockReturnValue(mockApp);
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.error.mockRestore();
    jest.resetModules();
  });

  describe('Module Imports and Initial Setup', () => {
    test('should import all required modules', async () => {
      // Just importing the module should work without errors
      await expect(import('../../index.js')).resolves.toBeDefined();
    });

    test('should configure dotenv on import', async () => {
      const dotenv = await import('dotenv');
      await import('../../index.js');
      expect(dotenv.default.config).toHaveBeenCalled();
    });

    test('should create Express app on import', async () => {
      const express = await import('express');
      await import('../../index.js');
      expect(express.default).toHaveBeenCalled();
    });

    test('should create HTTP server on import', async () => {
      const { createServer } = await import('http');
      await import('../../index.js');
      expect(createServer).toHaveBeenCalled();
    });

    test('should create WebSocket server on import', async () => {
      const { WebSocketServer } = await import('ws');
      await import('../../index.js');
      expect(WebSocketServer).toHaveBeenCalledWith({
        server: expect.anything(),
        path: '/graphql'
      });
    });

    test('should create GraphQL schema on import', async () => {
      const { makeExecutableSchema } = await import('@graphql-tools/schema');
      await import('../../index.js');
      expect(makeExecutableSchema).toHaveBeenCalledWith({
        typeDefs: expect.anything(),
        resolvers: expect.anything()
      });
    });

    test('should setup WebSocket server with useServer', async () => {
      const { useServer } = await import('graphql-ws/lib/use/ws');
      await import('../../index.js');
      expect(useServer).toHaveBeenCalledWith(
        {
          schema: expect.anything(),
          context: expect.any(Function)
        },
        expect.anything()
      );
    });

    test('should create Apollo Server with correct configuration', async () => {
      const { ApolloServer } = await import('@apollo/server');
      await import('../../index.js');
      expect(ApolloServer).toHaveBeenCalledWith({
        schema: expect.anything(),
        plugins: expect.arrayContaining([
          expect.anything(),
          expect.objectContaining({
            serverWillStart: expect.any(Function)
          })
        ])
      });
    });
  });

  describe('Server Startup Function', () => {
    test('should connect to MongoDB on startup', async () => {
      const { connectDB } = await import('../../config/db.js');
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(connectDB).toHaveBeenCalled();
    });

    test('should start Apollo Server', async () => {
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockApolloServer.start).toHaveBeenCalled();
    });

    test('should configure CORS middleware', async () => {
      const cors = await import('cors');
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockApp.use).toHaveBeenCalledWith(expect.anything());
      expect(cors.default).toHaveBeenCalled();
    });

    test('should configure JSON middleware', async () => {
      const express = await import('express');
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(express.default.json).toHaveBeenCalled();
      expect(mockApp.use).toHaveBeenCalledWith(expect.anything());
    });

    test('should configure session middleware', async () => {
      const session = await import('express-session');
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(session.default).toHaveBeenCalledWith({
        secret: 'test-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: false, // NODE_ENV is test
          maxAge: 24 * 60 * 60 * 1000
        }
      });
    });

    test('should initialize Passport', async () => {
      const passport = await import('../../helpers/googleAuth.js');
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(passport.default.initialize).toHaveBeenCalled();
      expect(passport.default.session).toHaveBeenCalled();
    });

    test('should setup Google OAuth routes', async () => {
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockApp.get).toHaveBeenCalledWith(
        '/auth/google',
        expect.any(Function)
      );
      expect(mockApp.get).toHaveBeenCalledWith(
        '/auth/google/callback',
        expect.any(Function),
        expect.any(Function)
      );
    });

    test('should setup Google Maps API key endpoint', async () => {
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockApp.get).toHaveBeenCalledWith(
        '/api/google-maps-key',
        expect.any(Function)
      );
    });

    test('should setup GraphQL middleware', async () => {
      const { expressMiddleware } = await import('@apollo/server/express4');
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(expressMiddleware).toHaveBeenCalledWith(
        mockApolloServer,
        {
          context: expect.any(Function)
        }
      );
    });

    test('should setup webhook routes', async () => {
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockApp.use).toHaveBeenCalledWith('/webhook', expect.anything());
    });

    test('should start HTTP server on correct port', async () => {
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockHttpServer.listen).toHaveBeenCalledWith(
        3001, // PORT from env
        expect.any(Function)
      );
    });

    test('should use default port when PORT env is not set', async () => {
      delete process.env.PORT;
      
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockHttpServer.listen).toHaveBeenCalledWith(
        3000, // default port
        expect.any(Function)
      );
    });

    test('should log success message when server starts', async () => {
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('Server siap di http://localhost:3001/graphql')
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket siap di ws://localhost:3001/graphql')
      );
    });
  });

  describe('CORS Configuration', () => {
    test('should allow localhost:3000 origin', async () => {
      const cors = await import('cors');
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const corsConfig = cors.default.mock.calls[0][0];
      const originFunction = corsConfig.origin;
      
      const mockCallback = jest.fn();
      originFunction('http://localhost:3000', mockCallback);
      
      expect(mockCallback).toHaveBeenCalledWith(null, true);
    });

    test('should allow localhost:5173 origin', async () => {
      const cors = await import('cors');
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const corsConfig = cors.default.mock.calls[0][0];
      const originFunction = corsConfig.origin;
      
      const mockCallback = jest.fn();
      originFunction('http://localhost:5173', mockCallback);
      
      expect(mockCallback).toHaveBeenCalledWith(null, true);
    });

    test('should allow undefined origin (same-origin requests)', async () => {
      const cors = await import('cors');
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const corsConfig = cors.default.mock.calls[0][0];
      const originFunction = corsConfig.origin;
      
      const mockCallback = jest.fn();
      originFunction(undefined, mockCallback);
      
      expect(mockCallback).toHaveBeenCalledWith(null, true);
    });

    test('should reject unauthorized origins', async () => {
      const cors = await import('cors');
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const corsConfig = cors.default.mock.calls[0][0];
      const originFunction = corsConfig.origin;
      
      const mockCallback = jest.fn();
      originFunction('http://malicious-site.com', mockCallback);
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Not allowed by CORS'
        })
      );
    });

    test('should have correct CORS options', async () => {
      const cors = await import('cors');
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const corsConfig = cors.default.mock.calls[0][0];
      
      expect(corsConfig).toMatchObject({
        credentials: true,
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      });
    });
  });

  describe('Google Maps API Endpoint', () => {
    test('should return API key when configured', async () => {
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Find the Google Maps endpoint handler
      const googleMapsCall = mockApp.get.mock.calls.find(
        call => call[0] === '/api/google-maps-key'
      );
      
      expect(googleMapsCall).toBeDefined();
      
      const handler = googleMapsCall[1];
      const mockReq = {};
      const mockRes = {
        json: jest.fn(),
        status: jest.fn(() => ({ json: jest.fn() }))
      };
      
      handler(mockReq, mockRes);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        apiKey: 'test-api-key'
      });
    });

    test('should return error when API key not configured', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Find the Google Maps endpoint handler
      const googleMapsCall = mockApp.get.mock.calls.find(
        call => call[0] === '/api/google-maps-key'
      );
      
      const handler = googleMapsCall[1];
      const mockReq = {};
      const mockRes = {
        json: jest.fn(),
        status: jest.fn(() => ({ json: jest.fn() }))
      };
      
      handler(mockReq, mockRes);
      
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    test('should handle errors gracefully', async () => {
      // Force an error by making process.env.GOOGLE_MAPS_API_KEY throw
      Object.defineProperty(process.env, 'GOOGLE_MAPS_API_KEY', {
        get: () => { throw new Error('Test error'); }
      });
      
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const googleMapsCall = mockApp.get.mock.calls.find(
        call => call[0] === '/api/google-maps-key'
      );
      
      const handler = googleMapsCall[1];
      const mockReq = {};
      const mockRes = {
        json: jest.fn(),
        status: jest.fn(() => ({ json: jest.fn() }))
      };
      
      handler(mockReq, mockRes);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Error providing Google Maps API key:',
        expect.any(Error)
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Google OAuth Callback', () => {
    test('should redirect with token on successful authentication', async () => {
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Find the callback endpoint handler
      const callbackCall = mockApp.get.mock.calls.find(
        call => call[0] === '/auth/google/callback'
      );
      
      expect(callbackCall).toBeDefined();
      
      const handler = callbackCall[2]; // Third parameter is the success handler
      const mockReq = { user: { id: '123', email: 'test@test.com' } };
      const mockRes = {
        redirect: jest.fn()
      };
      
      handler(mockReq, mockRes);
      
      expect(global.generateGoogleAuthToken).toHaveBeenCalledWith(mockReq.user);
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://localhost:3000/login?token=mock-token'
      );
    });
  });

  describe('WebSocket Context Function', () => {
    test('should create context function for WebSocket', async () => {
      const { useServer } = await import('graphql-ws/lib/use/ws');
      const { authContext } = await import('../../helpers/jwt.js');
      
      await import('../../index.js');
      
      const useServerCall = useServer.mock.calls[0];
      const contextFunction = useServerCall[0].context;
      
      const mockCtx = { connectionParams: { authorization: 'Bearer token' } };
      await contextFunction(mockCtx);
      
      expect(authContext).toHaveBeenCalledWith({
        connection: { authorization: 'Bearer token' }
      });
    });
  });

  describe('GraphQL Context Function', () => {
    test('should create context function for GraphQL middleware', async () => {
      const { expressMiddleware } = await import('@apollo/server/express4');
      const { authContext } = await import('../../helpers/jwt.js');
      
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const middlewareCall = expressMiddleware.mock.calls[0];
      const contextFunction = middlewareCall[1].context;
      
      const mockReq = { headers: { authorization: 'Bearer token' } };
      await contextFunction({ req: mockReq });
      
      expect(authContext).toHaveBeenCalledWith({ req: mockReq });
    });
  });

  describe('Server Cleanup Plugin', () => {
    test('should setup server cleanup plugin', async () => {
      const { ApolloServer } = await import('@apollo/server');
      await import('../../index.js');
      
      const serverConfig = ApolloServer.mock.calls[0][0];
      const cleanupPlugin = serverConfig.plugins.find(
        plugin => plugin.serverWillStart
      );
      
      expect(cleanupPlugin).toBeDefined();
      expect(cleanupPlugin.serverWillStart).toBeInstanceOf(Function);
    });

    test('should return drainServer function from cleanup plugin', async () => {
      const { ApolloServer } = await import('@apollo/server');
      await import('../../index.js');
      
      const serverConfig = ApolloServer.mock.calls[0][0];
      const cleanupPlugin = serverConfig.plugins.find(
        plugin => plugin.serverWillStart
      );
      
      const result = await cleanupPlugin.serverWillStart();
      
      expect(result).toHaveProperty('drainServer');
      expect(result.drainServer).toBeInstanceOf(Function);
    });

    test('should call serverCleanup.dispose on drainServer', async () => {
      const { useServer } = await import('graphql-ws/lib/use/ws');
      const { ApolloServer } = await import('@apollo/server');
      
      // Setup mock serverCleanup
      const mockServerCleanup = { dispose: jest.fn() };
      useServer.mockReturnValue(mockServerCleanup);
      
      await import('../../index.js');
      
      const serverConfig = ApolloServer.mock.calls[0][0];
      const cleanupPlugin = serverConfig.plugins.find(
        plugin => plugin.serverWillStart
      );
      
      const result = await cleanupPlugin.serverWillStart();
      await result.drainServer();
      
      expect(mockServerCleanup.dispose).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle MongoDB connection errors', async () => {
      const { connectDB } = await import('../../config/db.js');
      connectDB.mockRejectedValueOnce(new Error('MongoDB connection failed'));
      
      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      process.exit = jest.fn();
      
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '❌ Error starting server:',
        expect.any(Error)
      );
      expect(process.exit).toHaveBeenCalledWith(1);
      
      // Restore process.exit
      process.exit = originalExit;
    });

    test('should handle Apollo Server start errors', async () => {
      mockApolloServer.start.mockRejectedValueOnce(new Error('Apollo start failed'));
      
      // Mock process.exit to prevent actual exit
      const originalExit = process.exit;
      process.exit = jest.fn();
      
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        '❌ Error starting server:',
        expect.any(Error)
      );
      expect(process.exit).toHaveBeenCalledWith(1);
      
      // Restore process.exit
      process.exit = originalExit;
    });
  });

  describe('Environment Configuration', () => {
    test('should use WS_PATH from environment', async () => {
      process.env.WS_PATH = '/custom-graphql';
      
      const { WebSocketServer } = await import('ws');
      await import('../../index.js');
      
      expect(WebSocketServer).toHaveBeenCalledWith({
        server: expect.anything(),
        path: '/custom-graphql'
      });
    });

    test('should use default WS_PATH when not set', async () => {
      delete process.env.WS_PATH;
      
      const { WebSocketServer } = await import('ws');
      await import('../../index.js');
      
      expect(WebSocketServer).toHaveBeenCalledWith({
        server: expect.anything(),
        path: '/graphql'
      });
    });

    test('should use SESSION_SECRET from environment', async () => {
      process.env.SESSION_SECRET = 'custom-secret';
      
      const session = await import('express-session');
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(session.default).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: 'custom-secret'
        })
      );
    });

    test('should use default SESSION_SECRET when not set', async () => {
      delete process.env.SESSION_SECRET;
      
      const session = await import('express-session');
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(session.default).toHaveBeenCalledWith(
        expect.objectContaining({
          secret: 'your-secret-key'
        })
      );
    });

    test('should set secure cookie in production', async () => {
      process.env.NODE_ENV = 'production';
      
      const session = await import('express-session');
      await import('../../index.js');
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(session.default).toHaveBeenCalledWith(
        expect.objectContaining({
          cookie: expect.objectContaining({
            secure: true
          })
        })
      );
    });
  });
});
