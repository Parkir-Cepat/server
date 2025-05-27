# Testing Documentation - Parkir Cepat Server

Dokumentasi lengkap untuk testing pada proyek Parkir Cepat Server menggunakan Jest dan Supertest dengan target coverage minimal 90%.

## 📋 Daftar Isi

- [Overview](#overview)
- [Setup](#setup)
- [Struktur Testing](#struktur-testing)
- [Menjalankan Tests](#menjalankan-tests)
- [Coverage Report](#coverage-report)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

Proyek ini mengimplementasikan Test-Driven Development (TDD) dengan coverage minimal 90% menggunakan:

- **Jest**: Framework testing utama
- **Supertest**: Testing HTTP endpoints dan GraphQL
- **MongoDB Memory Server**: In-memory database untuk testing
- **Babel**: Transpiler untuk ES modules

### Target Coverage
- **Lines**: ≥ 90%
- **Functions**: ≥ 90%
- **Branches**: ≥ 90%
- **Statements**: ≥ 90%

## 🚀 Setup

### Prerequisites
- Node.js ≥ 16.x
- npm ≥ 8.x
- MongoDB (untuk development, testing menggunakan in-memory)

### Installation
```bash
# Install dependencies
npm install

# Setup test environment
./scripts/test.sh setup

# Atau manual setup
chmod +x scripts/test.sh
```

### Environment Variables
File `env.test` akan dibuat otomatis dengan konfigurasi testing:

```env
NODE_ENV=test
PORT=4001
MONGODB_URI=mongodb://localhost:27017/parkir_cepat_test
JWT_SECRET=test-jwt-secret-key-for-testing
# ... dan lainnya
```

## 📁 Struktur Testing

```
__tests__/
├── setup.js                 # Global test setup
├── utils/
│   ├── testHelpers.js       # Helper functions dan mock data
│   └── testServer.js        # Test server configuration
├── unit/                    # Unit tests
│   ├── helpers/
│   │   ├── bcrypt.test.js
│   │   ├── jwt.test.js
│   │   └── ...
│   └── models/
│       ├── User.test.js
│       └── ...
└── integration/             # Integration tests
    ├── resolvers/
    │   ├── userResolvers.test.js
    │   └── ...
    └── routes/
        └── webhook.test.js
```

### Jenis Testing

#### 1. Unit Tests
- **Helper Functions**: bcrypt, JWT, QR code, dll
- **Models**: User, Booking, Payment, dll
- **Utilities**: Validasi, transformasi data

#### 2. Integration Tests
- **GraphQL Resolvers**: Query dan Mutation
- **HTTP Routes**: Webhook, health check
- **Authentication**: JWT middleware
- **Database Operations**: CRUD operations

## 🏃‍♂️ Menjalankan Tests

### Menggunakan npm scripts:

```bash
# Semua tests
npm test

# Unit tests saja
npm run test:unit

# Integration tests saja
npm run test:integration

# Tests dengan coverage
npm run test:coverage

# Watch mode (development)
npm run test:watch
```

### Menggunakan test script:

```bash
# Semua tests
./scripts/test.sh all

# Unit tests
./scripts/test.sh unit

# Integration tests
./scripts/test.sh integration

# Coverage report
./scripts/test.sh coverage

# Watch mode
./scripts/test.sh watch

# Clean artifacts
./scripts/test.sh clean
```

## 📊 Coverage Report

### Viewing Coverage
```bash
# Generate coverage report
npm run test:coverage

# Open HTML report
open coverage/lcov-report/index.html
```

### Coverage Thresholds
Jest dikonfigurasi untuk memastikan coverage minimal 90%:

```javascript
"coverageThreshold": {
  "global": {
    "branches": 90,
    "functions": 90,
    "lines": 90,
    "statements": 90
  }
}
```

### Coverage Files
- `coverage/lcov-report/index.html` - HTML report
- `coverage/coverage-summary.json` - JSON summary
- `coverage/lcov.info` - LCOV format

## 🎯 Best Practices

### 1. Test Structure
```javascript
describe('Feature/Component Name', () => {
  beforeEach(() => {
    // Setup untuk setiap test
  });

  describe('Method/Function Name', () => {
    it('should do something when condition', async () => {
      // Arrange
      const input = 'test data';
      
      // Act
      const result = await functionUnderTest(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### 2. Mock External Dependencies
```javascript
// Mock external services
jest.mock('../../../config/db.js');
jest.mock('bcryptjs');

// Mock dengan implementasi custom
jest.mock('../../../helpers/midtrans.js', () => ({
  verifyNotification: jest.fn().mockResolvedValue({
    orderId: 'ORD-123',
    status: 'settlement'
  })
}));
```

### 3. Database Testing
```javascript
beforeEach(async () => {
  await cleanupDatabase();
});

// Gunakan helper functions
const user = await createTestUser(db, {
  email: 'test@example.com'
});
```

### 4. GraphQL Testing
```javascript
const query = `
  query {
    me {
      _id
      email
    }
  }
`;

const response = await request(app)
  .post('/graphql')
  .set('Authorization', `Bearer ${token}`)
  .send({ query });

expectGraphQLSuccess(response);
```

## 🔧 Troubleshooting

### Common Issues

#### 1. MongoDB Connection Error
```bash
# Pastikan MongoDB Memory Server berjalan
# Check setup.js configuration
```

#### 2. Jest Timeout
```javascript
// Increase timeout in jest.config.js
jest.setTimeout(30000);
```

#### 3. ES Modules Error
```bash
# Pastikan babel.config.js sudah benar
# Check package.json "type": "module"
```

#### 4. Coverage Threshold Failed
```bash
# Lihat coverage report untuk file yang kurang
npm run test:coverage
open coverage/lcov-report/index.html
```

### Debug Mode
```bash
# Run dengan debug
NODE_ENV=test DEBUG=* npm test

# Run specific test file
npm test -- __tests__/unit/helpers/jwt.test.js

# Run dengan verbose output
npm test -- --verbose
```

## 📝 Writing New Tests

### 1. Unit Test Template
```javascript
import { functionToTest } from '../../../path/to/module.js';

describe('Module Name', () => {
  describe('functionToTest', () => {
    it('should return expected result for valid input', () => {
      // Test implementation
    });

    it('should throw error for invalid input', () => {
      // Error case testing
    });
  });
});
```

### 2. Integration Test Template
```javascript
import request from 'supertest';
import { createTestServer } from '../../utils/testServer.js';

describe('Feature Integration Tests', () => {
  let app;

  beforeAll(async () => {
    app = await createTestServer();
  });

  it('should handle request successfully', async () => {
    const response = await request(app)
      .post('/endpoint')
      .send(data);

    expect(response.status).toBe(200);
  });
});
```

## 🚀 Continuous Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm install
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v1
```

## 📚 Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server)
- [GraphQL Testing Best Practices](https://graphql.org/learn/testing/)

---

**Happy Testing! 🎉**

Untuk pertanyaan atau issues, silakan buat issue di repository atau hubungi tim development. 