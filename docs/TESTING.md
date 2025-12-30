# Testing Guide

Comprehensive testing documentation for the User Service.

## Table of Contents

- [Testing Strategy](#testing-strategy)
- [Test Structure](#test-structure)
- [Running Tests](#running-tests)
- [Unit Tests](#unit-tests)
- [Integration Tests](#integration-tests)
- [End-to-End Tests](#end-to-end-tests)
- [Test Coverage](#test-coverage)
- [Best Practices](#best-practices)

## Testing Strategy

### Test Pyramid

```
       /\
      /E2E\       ← Few, high-value scenarios
     /------\
    /  INT   \    ← Service interactions
   /----------\
  /    UNIT    \  ← Most tests here
 /--------------\
```

- **Unit Tests (70%)**: Fast, isolated, test individual functions
- **Integration Tests (20%)**: Test service interactions (DB, Dapr)
- **E2E Tests (10%)**: Full user workflows

### Coverage Goals

- **Overall**: ≥ 80%
- **Critical paths**: 100% (auth, user creation)
- **Business logic**: ≥ 90%
- **Controllers**: ≥ 80%
- **Utils**: ≥ 85%

## Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── controllers/
│   │   └── user.controller.test.js
│   ├── services/
│   │   └── user.service.test.js
│   ├── middlewares/
│   │   └── auth.middleware.test.js
│   └── utils/
│       └── validator.test.js
├── integration/             # Integration tests
│   ├── database/
│   │   └── user.repository.test.js
│   ├── dapr/
│   │   └── pubsub.test.js
│   └── api/
│       └── user.api.test.js
├── e2e/                    # End-to-end tests
│   └── user-workflow.test.js
├── fixtures/               # Test data
│   └── users.json
├── helpers/                # Test utilities
│   ├── db-helper.js
│   └── auth-helper.js
└── setup.js               # Global test setup
```

## Running Tests

### All Tests

```bash
npm test
```

### Unit Tests Only

```bash
npm run test:unit
```

### Integration Tests Only

```bash
npm run test:integration
```

### E2E Tests

```bash
npm run test:e2e
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

View coverage report at `coverage/lcov-report/index.html`

### Specific Test File

```bash
npm test -- tests/unit/user.service.test.js
```

### Specific Test Case

```bash
npm test -- --testNamePattern="should create user"
```

### Debug Tests

```bash
# VS Code: Use "Jest Debug" configuration
# Or:
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Unit Tests

### Example: Service Unit Test

**File**: `tests/unit/services/user.service.test.js`

```javascript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import UserService from '../../../src/services/user.service.js';
import User from '../../../src/models/user.model.js';

// Mock dependencies
jest.mock('../../../src/models/user.model.js');

describe('UserService', () => {
  let userService;
  
  beforeEach(() => {
    userService = new UserService();
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'Test123!',
        firstName: 'Test',
        lastName: 'User'
      };
      
      const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        ...userData,
        save: jest.fn().mockResolvedValue(true)
      };
      
      User.mockImplementation(() => mockUser);
      User.findOne = jest.fn().mockResolvedValue(null);

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({ email: userData.email });
      expect(result).toHaveProperty('userId');
      expect(result.email).toBe(userData.email);
    });

    it('should throw error if email exists', async () => {
      // Arrange
      const userData = {
        email: 'existing@example.com',
        password: 'Test123!'
      };
      
      User.findOne = jest.fn().mockResolvedValue({ email: userData.email });

      // Act & Assert
      await expect(userService.createUser(userData))
        .rejects
        .toThrow('Email already exists');
    });

    it('should validate password strength', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'weak'  // Too weak
      };

      // Act & Assert
      await expect(userService.createUser(userData))
        .rejects
        .toThrow('Password too weak');
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      const mockUser = {
        _id: userId,
        email: 'test@example.com',
        firstName: 'Test'
      };
      
      User.findById = jest.fn().mockResolvedValue(mockUser);

      // Act
      const result = await userService.getUserById(userId);

      // Assert
      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      // Arrange
      User.findById = jest.fn().mockResolvedValue(null);

      // Act
      const result = await userService.getUserById('nonexistent');

      // Assert
      expect(result).toBeNull();
    });
  });
});
```

### Running Unit Tests

```bash
npm run test:unit
```

**Best Practices**:
- Mock external dependencies (DB, APIs, Dapr)
- Test one thing per test case
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

## Integration Tests

### Example: Database Integration Test

**File**: `tests/integration/database/user.repository.test.js`

```javascript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import User from '../../../src/models/user.model.js';
import { connectDatabase, disconnectDatabase } from '../../../src/database/database.js';

describe('User Repository Integration Tests', () => {
  beforeAll(async () => {
    await connectDatabase(process.env.MONGODB_TEST_URI);
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    // Clear database before each test
    await User.deleteMany({});
  });

  describe('User CRUD Operations', () => {
    it('should create and retrieve user', async () => {
      // Create user
      const user = new User({
        email: 'integration@example.com',
        password: 'Test123!',
        firstName: 'Integration',
        lastName: 'Test'
      });
      await user.save();

      // Retrieve user
      const foundUser = await User.findOne({ email: 'integration@example.com' });
      
      expect(foundUser).not.toBeNull();
      expect(foundUser.email).toBe('integration@example.com');
      expect(foundUser.firstName).toBe('Integration');
    });

    it('should enforce unique email constraint', async () => {
      // Create first user
      const user1 = new User({
        email: 'duplicate@example.com',
        password: 'Test123!',
        firstName: 'User1'
      });
      await user1.save();

      // Try to create duplicate
      const user2 = new User({
        email: 'duplicate@example.com',
        password: 'Test456!',
        firstName: 'User2'
      });

      await expect(user2.save()).rejects.toThrow();
    });

    it('should hash password on save', async () => {
      const plainPassword = 'Test123!';
      const user = new User({
        email: 'password@example.com',
        password: plainPassword,
        firstName: 'Test'
      });
      await user.save();

      const savedUser = await User.findOne({ email: 'password@example.com' });
      
      expect(savedUser.password).not.toBe(plainPassword);
      expect(savedUser.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt format
    });
  });
});
```

### Running Integration Tests

```bash
# Start test database
docker run -d --name user-test-mongodb -p 27019:27017 mongo:8

# Run tests
MONGODB_TEST_URI=mongodb://localhost:27019/test npm run test:integration

# Cleanup
docker stop user-test-mongodb && docker rm user-test-mongodb
```

**Best Practices**:
- Use separate test database
- Clean up data between tests
- Test actual DB queries and constraints
- Test Dapr component interactions

## End-to-End Tests

### Example: User Workflow E2E Test

**File**: `tests/e2e/user-workflow.test.js`

```javascript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../src/app.js';

describe('User Registration Workflow E2E', () => {
  let server;
  let createdUserId;
  let authToken;

  beforeAll(async () => {
    // Start server
    server = app.listen(0); // Random port
  });

  afterAll(async () => {
    // Cleanup
    if (createdUserId) {
      await request(server)
        .delete(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
    await server.close();
  });

  it('should complete full user registration workflow', async () => {
    // Step 1: Register user
    const registerRes = await request(server)
      .post('/api/users')
      .send({
        email: 'e2e@example.com',
        password: 'Test123!',
        firstName: 'E2E',
        lastName: 'Test'
      })
      .expect(201);

    expect(registerRes.body.success).toBe(true);
    expect(registerRes.body.data).toHaveProperty('userId');
    createdUserId = registerRes.body.data.userId;

    // Step 2: Authenticate (assuming auth-service integration)
    const loginRes = await request(server)
      .post('/api/auth/login')
      .send({
        email: 'e2e@example.com',
        password: 'Test123!'
      })
      .expect(200);

    authToken = loginRes.body.data.token;

    // Step 3: Get user profile
    const profileRes = await request(server)
      .get(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(profileRes.body.data.email).toBe('e2e@example.com');
    expect(profileRes.body.data.isEmailVerified).toBe(false);

    // Step 4: Update profile
    const updateRes = await request(server)
      .put(`/api/users/${createdUserId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        firstName: 'Updated',
        phoneNumber: '+1234567890'
      })
      .expect(200);

    expect(updateRes.body.data.firstName).toBe('Updated');
    expect(updateRes.body.data.phoneNumber).toBe('+1234567890');

    // Step 5: Change password
    await request(server)
      .post(`/api/users/${createdUserId}/change-password`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        currentPassword: 'Test123!',
        newPassword: 'NewPass456!',
        confirmPassword: 'NewPass456!'
      })
      .expect(200);

    // Step 6: Login with new password
    const newLoginRes = await request(server)
      .post('/api/auth/login')
      .send({
        email: 'e2e@example.com',
        password: 'NewPass456!'
      })
      .expect(200);

    expect(newLoginRes.body.data).toHaveProperty('token');
  });
});
```

### Running E2E Tests

```bash
# Start all dependencies (MongoDB, Dapr, other services)
npm run start:infrastructure

# Run E2E tests
npm run test:e2e

# Cleanup
npm run stop:infrastructure
```

**Best Practices**:
- Test complete user journeys
- Use realistic data
- Clean up test data
- Run against test environment

## Test Coverage

### Generate Coverage Report

```bash
npm run test:coverage
```

### Coverage Thresholds

Configured in `jest.config.js`:

```javascript
export default {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/services/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
```

### View Coverage

```bash
# Open HTML report
open coverage/lcov-report/index.html  # Mac
start coverage/lcov-report/index.html  # Windows
xdg-open coverage/lcov-report/index.html  # Linux
```

### CI Coverage Check

Coverage is checked in GitHub Actions:

```yaml
- name: Run tests with coverage
  run: npm run test:coverage
  
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## Best Practices

### Test Organization

✅ **DO**:
- Group related tests with `describe`
- Use descriptive test names
- One assertion per test (when possible)
- Test edge cases and error paths

❌ **DON'T**:
- Write tests dependent on execution order
- Test implementation details
- Ignore flaky tests
- Skip error scenarios

### Test Data

✅ **DO**:
- Use test fixtures for complex data
- Generate unique test data per run
- Clean up test data after tests

❌ **DON'T**:
- Use production data
- Hard-code IDs or timestamps
- Leave test data in database

### Mocking

✅ **DO**:
- Mock external services (APIs, databases for unit tests)
- Use test doubles appropriately
- Verify mock interactions

❌ **DON'T**:
- Mock everything in integration tests
- Forget to clear mocks between tests
- Over-mock (tests become meaningless)

### Performance

✅ **DO**:
- Run unit tests frequently
- Keep tests fast (< 100ms per unit test)
- Parallelize test execution

❌ **DON'T**:
- Make tests wait unnecessarily
- Use `sleep()` or fixed delays
- Run E2E tests on every commit

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:8
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm run test:coverage
        env:
          MONGODB_URI: mongodb://localhost:27017/test
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Troubleshooting Tests

### Tests Timing Out

```bash
# Increase timeout
jest --testTimeout=10000
```

### Database Connection Issues

```bash
# Check MongoDB is running
docker ps | grep mongo

# Check connection string
echo $MONGODB_TEST_URI
```

### Jest Cache Issues

```bash
# Clear Jest cache
npm test -- --clearCache
```

### Debugging Failures

```bash
# Run with verbose output
npm test -- --verbose

# Run specific failing test
npm test -- --testNamePattern="failing test" --verbose
```

## Next Steps

- [Development Guide](DEVELOPMENT.md) - Set up local environment
- [API Reference](API.md) - Understand endpoints to test
- [Contributing Guide](CONTRIBUTING.md) - Submit your tests
