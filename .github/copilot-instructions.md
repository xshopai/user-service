# Copilot Instructions for User Service

**Service**: User management microservice for xshopai platform  
**Stack**: Node.js 18+, Express 5.1.0, MongoDB 8.18.0, Mongoose 8.18.0  
**Port**: 8002 | **Dapr HTTP**: 3500 | **Dapr gRPC**: 50001  
**Pattern**: Pure Publisher (Dapr Pub/Sub → RabbitMQ)

## Architecture at a Glance

```
src/
├── core/              # Config, logging, errors (centralized utilities)
├── events/            # Event publishing (CloudEvents via Dapr)
├── clients/           # External integrations (Dapr client, secret manager)
├── controllers/       # HTTP handlers (thin, delegate to services)
├── services/          # Business logic (validation, data manipulation)
├── models/            # Mongoose schemas (User model with subdocs)
├── schemas/           # Reusable subdocuments (address, payment, wishlist, preferences)
├── middlewares/       # Express middleware (auth, tracing, async, errors)
├── validators/        # Input validation (email, password, phone)
├── routes/            # Route definitions (map URLs to controllers)
├── database/          # MongoDB connection setup
├── app.js            # Express app configuration
└── server.js         # Entry point (loads env → imports app)
```

**Critical flows**:

- Secrets: Dapr Secret Store → env fallback (`src/clients/dapr.secret.manager.js`)
- Events: Controllers → `src/events/publisher.js` → Dapr Pub/Sub → RabbitMQ
- Auth: JWT (issued by auth-service) → `requireAuth` middleware → attach `req.user`
- Tracing: `traceContext.middleware.js` → adds `req.traceId`/`req.spanId` → all logs/events

---

## Essential Patterns

### 1. Event Publishing (Always Use Dapr)

**Location**: `src/events/publisher.js` (NOT `src/services/daprPublisher.js`)

```javascript
import { publishUserCreated, publishUserUpdated } from '../events/publisher.js';

// In controller after DB operation
await publishUserCreated(user, req.traceId, req.ip, req.headers['user-agent']);
```

**Event format** (CloudEvents-compliant):

```javascript
{
  specversion: '1.0',
  type: 'com.xshopai.user.created',
  source: 'user-service',
  id: `${Date.now()}-${random}`,
  time: '2025-11-19T10:30:00Z',
  datacontenttype: 'application/json',
  data: { userId, email, firstName, ... },
  metadata: { traceId, ipAddress, userAgent, environment }
}
```

**Available publishers**: `publishUserCreated`, `publishUserUpdated`, `publishUserDeleted`, `publishUserLoggedIn`, `publishUserLoggedOut`

**Never** import `amqplib` or call RabbitMQ directly - Dapr abstracts all broker communication.

### 2. Controller Pattern

```javascript
import asyncHandler from '../middlewares/asyncHandler.js';
import ErrorResponse from '../core/errors.js';
import logger from '../core/logger.js';
import { publishUserCreated } from '../events/publisher.js';

export const createUser = asyncHandler(async (req, res, next) => {
  // 1. Validate (use validators from src/validators/)
  const validation = userValidator.validateUserData(req.body);
  if (!validation.valid) {
    return next(new ErrorResponse(validation.error, 400, validation.code));
  }

  // 2. Business logic
  const user = await User.create(req.body);

  // 3. Publish event (graceful - logs warning if Dapr unavailable)
  await publishUserCreated(user, req.traceId, req.ip, req.headers['user-agent']);

  // 4. Log with trace context
  logger.info('User created successfully', null, {
    operation: 'create_user',
    userId: user._id.toString(),
    traceId: req.traceId,
  });

  // 5. Response
  res.status(201).json(user);
});
```

**Key points**:

- Use `asyncHandler` (auto-catches errors, calls `next(err)`)
- Never throw raw errors - use `ErrorResponse(message, statusCode, code)`
- Always include `traceId` in logs/events (from `req.traceId`)
- Event publishing is **non-blocking** - service works even if Dapr is down

### 3. Authentication & Authorization

**JWT validation** (auth-service issues tokens, user-service validates):

```javascript
import { requireAuth, requireRoles, requireAdmin } from '../middlewares/auth.middleware.js';

// Protected route
router.get('/profile', requireAuth, getProfile);

// Role-based access
router.get('/admin/users', requireAuth, requireAdmin, listUsers);
router.post('/premium-feature', requireAuth, requireRoles('premium', 'admin'), usePremium);
```

**Access user**: `req.user` (populated by `requireAuth`):

```javascript
const userId = req.user._id; // from JWT
const roles = req.user.roles; // ['customer'] or ['admin']
```

**JWT secret** (from Dapr Secret Store or env fallback):

```javascript
import { getJwtConfig } from '../clients/index.js';
const { secret } = await getJwtConfig(); // Cached after first call
```

### 4. Mongoose Models & Subdocuments

**User model** (`src/models/user.model.js`) with embedded arrays:

```javascript
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, minlength: 6 }, // Auto-hashed by pre-save hook
    addresses: [addressSchema], // Embedded subdocs
    paymentMethods: [paymentSchema],
    wishlist: [wishlistSchema],
    preferences: preferencesSchema, // Single subdoc
    roles: { type: [String], enum: ['customer', 'admin'], default: ['customer'] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Pre-save hook: hash password if modified, handle audit fields
userSchema.pre('save', async function (next) {
  if (this.isModified('password') && !/^\$2[aby]\$/.test(this.password)) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  if (this.isNew && !this.createdBy) this.createdBy = 'SELF_REGISTRATION';
  next();
});
```

**Adding subdocuments**:

```javascript
user.addresses.push({ type: 'shipping', fullName: 'John Doe', ... });
await user.save(); // Triggers validation
```

**Removing subdocuments**:

```javascript
user.addresses.id(addressId).remove();
await user.save();
```

**Always exclude password** from responses:

```javascript
const user = await User.findById(userId).select('-password');
```

### 5. Configuration & Secrets

**Non-sensitive config** (`src/core/config.js`):

```javascript
import config from '../core/config.js';
const port = config.service.port; // 8002
const daprPort = config.dapr.httpPort; // 3500
const logLevel = config.logging.level; // 'debug'
```

**Sensitive secrets** (Dapr Secret Store → env fallback):

```javascript
import { getDatabaseConfig, getJwtConfig } from '../clients/index.js';

const dbConfig = await getDatabaseConfig(); // { host, port, username, password, database }
const jwtConfig = await getJwtConfig(); // { secret, expire }
```

**Environment variables** (`.env`):

```env
PORT=8002
DAPR_HTTP_PORT=3500
DAPR_PUBSUB_NAME=user-pubsub
MONGODB_HOST=localhost
MONGODB_PORT=27018
JWT_SECRET=your-secret-key
LOG_LEVEL=debug
```

**No `DAPR_ENABLED` flag** - service always tries Dapr first, falls back gracefully.

### 6. Logging & Tracing

**Structured logging** (Winston):

```javascript
import logger from '../core/logger.js';

logger.info('User created', null, {
  operation: 'create_user',
  userId: user._id.toString(),
  traceId: req.traceId, // From traceContext.middleware
  spanId: req.spanId,
});

logger.error('Failed to publish event', null, {
  operation: 'event_publish',
  eventType: 'user.created',
  error: err.message,
  traceId: req.traceId,
});
```

**Trace context** (automatic):

- `traceContext.middleware.js` extracts/generates `req.traceId` and `req.spanId`
- Use in all logs and event metadata for distributed tracing
- Header: `x-trace-id` (incoming) or generated UUID

**Never log**: passwords (even hashed), JWT tokens, full credit card numbers, SSNs

---

## Common Tasks

### Add a new endpoint

1. Define route in `src/routes/user.routes.js`:
   ```javascript
   router.post('/addresses', requireAuth, addAddress);
   ```
2. Create controller in `src/controllers/user.address.controller.js` (use `asyncHandler`)
3. Add validation in `src/validators/user.address.validator.js`
4. Publish event if state changes
5. Write tests in `tests/unit/controllers/`

### Add a new event type

1. Add function to `src/events/publisher.js`:
   ```javascript
   export async function publishUserEmailVerified(userId, email, traceId) {
     const client = getDaprClient();
     const eventData = {
       /* CloudEvents format */
     };
     await client.pubsub.publish(config.dapr.pubsubName, 'user.email_verified', eventData);
     logger.info('Published user.email_verified event', null, { userId, traceId });
   }
   ```
2. Call from controller after operation completes

### Testing

**Jest with ES modules** (`jest.config.js` uses `transform: {}`):

```bash
npm test                  # All tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:coverage     # Coverage report
```

**Unit test pattern** (mock external dependencies):

```javascript
import User from '../../../src/models/user.model.js';
import { publishUserCreated } from '../../../src/events/publisher.js';

jest.mock('../../../src/models/user.model.js');
jest.mock('../../../src/events/publisher.js');

describe('createUser', () => {
  it('should create user and publish event', async () => {
    User.create.mockResolvedValue({ _id: '123', email: 'test@example.com' });
    publishUserCreated.mockResolvedValue(undefined);

    // Execute controller logic...
    expect(User.create).toHaveBeenCalled();
    expect(publishUserCreated).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' }),
      expect.any(String), // traceId
      expect.any(String), // ipAddress
      expect.any(String), // userAgent
    );
  });
});
```

---

## Development Workflow

### Local setup

```bash
npm install
# Start infrastructure (MongoDB, RabbitMQ)
cd ../../scripts/docker-compose
docker-compose -f docker-compose.infrastructure.yml up -d

# Run with Dapr sidecar
./dapr.sh        # Linux/Mac
.\dapr.ps1       # Windows

# Or run without Dapr (direct mode)
./run.sh         # Linux/Mac
.\run.ps1        # Windows
# Or: npm run dev (starts with Dapr - see package.json)
```

### VS Code debugging

**`.vscode/launch.json`** has two configs:

- "Debug User Service (Direct)" - no Dapr
- "Debug User Service (with Dapr)" - full stack

**`.vscode/tasks.json`** has:

- "Kill Port 8002" - cleanup before debug
- "Start Dapr Sidecar" - manual Dapr start
- "Stop Dapr Sidecar" - cleanup after debug

### API testing

```bash
# Health check
curl http://localhost:8002/api/health

# Via Dapr
curl http://localhost:3500/v1.0/invoke/user-service/method/api/health

# Create user
curl -X POST http://localhost:8002/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123","firstName":"John"}'
```

---

## Key Differences from Documentation

**Outdated references in docs** (use actual code):

- ❌ `src/services/daprPublisher.js` → ✅ `src/events/publisher.js`
- ❌ `req.correlationId` → ✅ `req.traceId` (trace context middleware)
- ❌ `DAPR_ENABLED` env var → ✅ Removed (always uses Dapr, graceful fallback)
- ❌ `src/observability/` → ✅ `src/core/logger.js` (centralized)

**Project structure** (actual vs docs):

```
Actual:
src/
├── core/          ← Config, logger, errors
├── events/        ← Event publishers
├── clients/       ← Dapr clients, secret manager
└── ...

Docs say:
src/
├── observability/ ← Doesn't exist
├── services/      ← Has user.service.js but NOT daprPublisher.js
└── ...
```

---

## Requirements Reference

See `docs/PRD.md` for business requirements (REQ-1.x through REQ-9.x).  
See `docs/ARCHITECTURE.md` for technical architecture details.

**Mapping examples**:

- REQ-1.1 (User Registration) → `POST /api/users` → `user.controller.js::createUser` → publishes `user.created`
- REQ-3.1 (Add Address) → `POST /api/users/addresses` → `user.address.controller.js::addAddress` → subdocument push
- REQ-9.1 (Admin List Users) → `GET /api/admin/users` → requires `admin` role → `admin.controller.js::listUsers`

---

## Troubleshooting

**"Cannot find module 'C:\\...\\src\\clients\\config.js'"**  
→ Import from `../core/config.js` not `./config.js` (check import paths)

**Event publishing fails silently**  
→ Expected behavior - check logs for warning. Service continues without Dapr.

**JWT validation fails with "Invalid token"**  
→ Ensure auth-service issued token with correct secret. Check `JWT_SECRET` env var.

**Password not hashing**  
→ Pre-save hook checks if already hashed (`/^\$2[aby]\$/`). Don't manually hash.

**MongoDB connection fails**  
→ Check `MONGODB_HOST`, `MONGODB_PORT` in `.env`. Default: `localhost:27018`

---

**Quick reference imports**:

```javascript
import asyncHandler from '../middlewares/asyncHandler.js';
import ErrorResponse from '../core/errors.js';
import logger from '../core/logger.js';
import config from '../core/config.js';
import User from '../models/user.model.js';
import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';
import { publishUserCreated } from '../events/publisher.js';
import { getDatabaseConfig, getJwtConfig } from '../clients/index.js';
```

export const createUser = asyncHandler(async (req, res, next) => {
const { email, password, firstName, lastName } = req.body;

// 1. Validate input
if (!email) {
return next(new ErrorResponse('Email is required', 400, 'EMAIL_REQUIRED'));
}

// 2. Business logic
const user = await User.create({ email, password, firstName, lastName });

// 3. Publish event
await daprPublisher.publishUserCreated(user, req.correlationId, req.ip, req.get('user-agent'));

// 4. Structured logging
logger.info('User created successfully', null, {
operation: 'create_user',
userId: user.\_id.toString(),
correlationId: req.correlationId,
});

// 5. Response
res.status(201).json({
success: true,
message: 'User created successfully',
data: { userId: user.\_id, email: user.email },
});
});

````

### 3. Validation

Use custom validators from `validators/` directory:

```javascript
import userValidator from '../validators/user.validator.js';

// Email validation
if (!userValidator.isValidEmail(email)) {
  return next(new ErrorResponse('Invalid email format', 400, 'INVALID_EMAIL'));
}

// Password validation
const passwordValidation = userValidator.isValidPassword(password);
if (!passwordValidation.valid) {
  return next(new ErrorResponse(passwordValidation.error, 400, 'INVALID_PASSWORD'));
}
````

### 4. Authentication & Authorization

**JWT Validation Middleware:**

```javascript
import { requireAuth, optionalAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

// Protected endpoint (requires valid JWT)
router.get('/profile', requireAuth, getProfile);

// Admin-only endpoint
router.get('/admin/users', requireAuth, requireRole(['admin']), getUsers);

// Optional auth (works with or without token)
router.get('/public', optionalAuth, getPublicData);
```

**Access User from JWT:**

```javascript
export const getProfile = asyncHandler(async (req, res) => {
  // req.user is populated by requireAuth middleware
  const userId = req.user.userId; // from JWT payload
  const email = req.user.email;
  const roles = req.user.roles;

  const user = await User.findById(userId);
  res.json({ success: true, data: user });
});
```

### 5. Correlation ID

Always use correlation ID for distributed tracing:

```javascript
// Correlation ID automatically added by middleware (correlationId.middleware.js)
// Access it via: req.correlationId

logger.info('Processing request', null, {
  operation: 'update_user',
  userId: user._id,
  correlationId: req.correlationId, // Include in all logs
});

// Pass to event publishing
await daprPublisher.publishUserUpdated(user, req.correlationId);
```

### 6. Structured Logging

Use Winston logger with structured data:

```javascript
import logger from '../observability/index.js';

// Success logging
logger.info('User created', null, {
  operation: 'create_user',
  userId: user._id.toString(),
  email: user.email,
  correlationId: req.correlationId,
});

// Error logging
logger.error('Failed to create user', null, {
  operation: 'create_user',
  error: error.message,
  stack: error.stack,
  correlationId: req.correlationId,
});

// Warning logging
logger.warn('Event publishing failed', null, {
  operation: 'publish_event',
  eventType: 'user.created',
  userId: user._id.toString(),
  correlationId: req.correlationId,
});
```

**Log Levels:**

- `ERROR`: Failures requiring immediate attention
- `WARN`: Degraded functionality (e.g., event publishing failed but user created)
- `INFO`: Normal operations (user created, updated, deleted)
- `DEBUG`: Detailed diagnostic information

**Never log sensitive data:**

- ❌ Passwords (even hashed)
- ❌ JWT tokens
- ❌ Full credit card numbers (only last 4 digits)
- ❌ Social security numbers

### 7. Error Handling

Use `ErrorResponse` class for consistent error responses:

```javascript
import ErrorResponse from '../utils/ErrorResponse.js';

// 400 Bad Request
return next(new ErrorResponse('Invalid email format', 400, 'INVALID_EMAIL'));

// 401 Unauthorized
return next(new ErrorResponse('Authentication required', 401, 'UNAUTHORIZED'));

// 403 Forbidden
return next(new ErrorResponse('Insufficient permissions', 403, 'FORBIDDEN'));

// 404 Not Found
return next(new ErrorResponse('User not found', 404, 'USER_NOT_FOUND'));

// 409 Conflict
return next(new ErrorResponse('Email already exists', 409, 'EMAIL_EXISTS'));

// 500 Internal Server Error
return next(new ErrorResponse('Database error', 500, 'DATABASE_ERROR'));
```

**Error Response Format:**

```json
{
  "success": false,
  "message": "Invalid email format",
  "errorCode": "INVALID_EMAIL",
  "correlationId": "corr-123-abc"
}
```

### 8. Database Operations

**User Model (Mongoose):**

```javascript
import User from '../models/user.model.js';

// Create user
const user = await User.create({
  email: 'john@example.com',
  password: 'SecurePass123', // Auto-hashed by pre-save hook
  firstName: 'John',
  lastName: 'Doe',
  roles: ['customer'], // Default
});

// Find by ID
const user = await User.findById(userId);

// Find by email
const user = await User.findOne({ email: 'john@example.com' });

// Update user
const user = await User.findByIdAndUpdate(
  userId,
  { firstName: 'Jonathan', phoneNumber: '+1-555-9999' },
  { new: true, runValidators: true },
);

// Delete user
await User.findByIdAndDelete(userId);

// Add address
user.addresses.push({
  type: 'shipping',
  isDefault: true,
  fullName: 'John Doe',
  addressLine1: '123 Main St',
  city: 'New York',
  state: 'NY',
  postalCode: '10001',
  country: 'USA',
});
await user.save();

// Remove address
user.addresses.id(addressId).remove();
await user.save();
```

**Password Hashing:**

```javascript
// Passwords are automatically hashed by pre-save hook in User model
// NEVER manually hash passwords unless absolutely necessary

const user = await User.create({
  email: 'john@example.com',
  password: 'PlainTextPassword', // Automatically hashed with bcrypt (cost: 12)
});

// To verify password (done in auth-service)
const isMatch = await bcrypt.compare(candidatePassword, user.password);
```

### 9. API Response Format

**Success Response:**

```javascript
res.status(200).json({
  success: true,
  message: 'User updated successfully', // Optional
  data: { userId, email, firstName },
});
```

**Error Response:**

```javascript
res.status(400).json({
  success: false,
  message: 'Validation failed',
  errorCode: 'VALIDATION_ERROR',
  correlationId: req.correlationId,
});
```

**Paginated Response:**

```javascript
res.status(200).json({
  success: true,
  data: users,
  pagination: {
    page: 1,
    pageSize: 20,
    totalCount: 150,
    totalPages: 8,
  },
});
```

### 10. Testing

**Unit Tests (Jest):**

```javascript
import { createUser } from '../controllers/user.controller.js';
import User from '../models/user.model.js';
import daprPublisher from '../services/daprPublisher.js';

jest.mock('../models/user.model.js');
jest.mock('../services/daprPublisher.js');

describe('createUser Controller', () => {
  it('should create user and publish event', async () => {
    // Arrange
    const req = { body: { email: 'test@example.com', password: 'Pass123' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    User.create.mockResolvedValue({ _id: 'user-123', email: 'test@example.com' });
    daprPublisher.publishUserCreated.mockResolvedValue({ success: true });

    // Act
    await createUser(req, res, next);

    // Assert
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'test@example.com' }));
    expect(daprPublisher.publishUserCreated).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
```

**Integration Tests:**

```javascript
import request from 'supertest';
import app from '../app.js';

describe('POST /users', () => {
  it('should create user and return 201', async () => {
    const response = await request(app)
      .post('/users')
      .send({ email: 'test@example.com', password: 'SecurePass123' })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('test@example.com');
  });
});
```

---

## Common Tasks

### Adding a New Endpoint

1. **Define route** in `src/routes/user.routes.js`:

```javascript
router.post('/addresses', requireAuth, addAddress);
```

2. **Create controller** in `src/controllers/user.controller.js`:

```javascript
export const addAddress = asyncHandler(async (req, res, next) => {
  const userId = req.user.userId;
  const addressData = req.body;

  // Validate, process, publish event
  const user = await User.findById(userId);
  user.addresses.push(addressData);
  await user.save();

  await daprPublisher.publishUserUpdated(user, req.correlationId);

  res.status(200).json({ success: true, data: user.addresses });
});
```

3. **Add validation** in `src/validators/user.address.validator.js`

4. **Write tests** in `tests/`

### Publishing a New Event Type

1. **Add event publisher** in `src/services/daprPublisher.js`:

```javascript
export async function publishUserEmailVerified(userId, email, correlationId) {
  const data = { userId, email, verifiedAt: new Date().toISOString() };
  return await publishEvent('user.email_verified', data, {}, correlationId);
}
```

2. **Use in controller**:

```javascript
await daprPublisher.publishUserEmailVerified(user._id, user.email, req.correlationId);
```

3. **Document in PRD** (events section)

### Adding a New Sub-Schema

1. **Create schema** in `src/schemas/`:

```javascript
// loyaltyPoints.schema.js
import mongoose from 'mongoose';

const loyaltyPointsSchema = new mongoose.Schema({
  points: { type: Number, default: 0 },
  tier: { type: String, enum: ['bronze', 'silver', 'gold'], default: 'bronze' },
  lastEarned: { type: Date },
});

export default loyaltyPointsSchema;
```

2. **Add to User model**:

```javascript
import loyaltyPointsSchema from '../schemas/loyaltyPoints.schema.js';

const userSchema = new mongoose.Schema({
  // ... existing fields
  loyaltyPoints: loyaltyPointsSchema,
});
```

3. **Create validator** in `src/validators/user.loyalty.validator.js`

---

## Environment Variables

```env
# Server
PORT=8002
NODE_ENV=development

# MongoDB
MONGODB_CONNECTION_SCHEME=mongodb
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_USERNAME=
MONGODB_PASSWORD=
MONGODB_DB_NAME=user-service-db
MONGODB_DB_PARAMS=

# Dapr Configuration
DAPR_HOST=localhost
DAPR_HTTP_PORT=3500
PUBSUB_NAME=user-pubsub
TOPIC_NAME=user.events

# Logging
LOG_LEVEL=info
LOG_TO_CONSOLE=true
LOG_TO_FILE=false

# OpenTelemetry (optional)
OTEL_SERVICE_NAME=user-service
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

---

## Dependencies

### Internal Service Dependencies

- **Dapr** (Port 3500): Sidecar for pub/sub event publishing to RabbitMQ

### Infrastructure Dependencies

- **MongoDB** (Port 27017): Primary database

### No Dependencies On

- ❌ auth-service (auth-service depends on user-service, not vice versa)
- ❌ RabbitMQ/Kafka (abstracted by Dapr)
- ❌ External APIs

---

## Common Gotchas

### 1. Event Publishing Failures

**Problem**: Event publishing fails but user operation succeeds  
**Solution**: Graceful degradation - log warning, don't throw error

```javascript
const publishResult = await daprPublisher.publishUserCreated(user, correlationId);
if (!publishResult) {
  logger.warn('Event publishing failed, but user created successfully', {
    operation: 'create_user',
    userId: user._id,
    correlationId,
  });
}
// Continue - don't fail the request
```

### 2. Password Handling

**Problem**: Accidentally logging or returning passwords  
**Solution**:

- Use `.select('-password')` in queries
- Password auto-hashed by pre-save hook
- Never include password in responses

```javascript
// DON'T
const user = await User.findById(userId);
res.json({ data: user }); // Includes password hash!

// DO
const user = await User.findById(userId).select('-password');
res.json({ data: user }); // Safe
```

### 3. Mongoose Schema Validation

**Problem**: Validation errors not caught properly  
**Solution**: Use `runValidators: true` in updates

```javascript
await User.findByIdAndUpdate(
  userId,
  { email: 'newemail@example.com' },
  { new: true, runValidators: true }, // ✅ Validates email format
);
```

### 4. Correlation ID Propagation

**Problem**: Missing correlation ID in logs/events  
**Solution**: Always pass `req.correlationId` to services/events

```javascript
// DON'T
await daprPublisher.publishUserCreated(user);

// DO
await daprPublisher.publishUserCreated(user, req.correlationId, req.ip, req.get('user-agent'));
```

### 5. JWT Dependency Confusion

**Problem**: Thinking user-service validates JWTs  
**Solution**: User-service RECEIVES pre-validated tokens from auth-service

- JWT validation happens in auth-service
- User-service receives `req.user` from auth middleware (already decoded)
- User-service never calls auth-service APIs

---

## Code Style & Best Practices

### Naming Conventions

- **Files**: `camelCase.js` (e.g., `user.controller.js`)
- **Functions**: `camelCase` (e.g., `createUser`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `DAPR_HOST`, `PUBSUB_NAME`)
- **Classes**: `PascalCase` (e.g., `ErrorResponse`)

### Async/Await

- Always use `async/await` (no callbacks)
- Use `asyncHandler` middleware for controllers
- Handle errors with try/catch in services

### Imports

```javascript
// ES6 modules (not CommonJS)
import express from 'express'; // ✅
const express = require('express'); // ❌
```

### Comments

```javascript
// JSDoc for functions
/**
 * Create a new user
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next middleware
 */
export const createUser = asyncHandler(async (req, res, next) => {
  // Implementation
});
```

---

## Health Checks & Observability

### Health Check Endpoints

```javascript
GET / health; // Overall service health
GET / health / ready; // Kubernetes readiness probe
GET / health / live; // Kubernetes liveness probe
GET / metrics; // Prometheus metrics
```

### Monitoring

- Winston structured logs → stdout
- OpenTelemetry tracing (optional)
- Prometheus metrics (planned)
- Correlation ID in all logs

---

## Deployment

### Docker

```bash
docker build -t user-service:latest .
docker run -p 8002:8002 --env-file .env user-service:latest
```

### Local Development

```bash
npm install
npm run dev  # nodemon with hot reload
```

### Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

---

## Quick Reference

### Most Used Imports

```javascript
import ErrorResponse from '../utils/ErrorResponse.js';
import logger from '../observability/index.js';
import User from '../models/user.model.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import daprPublisher from '../services/daprPublisher.js';
import { requireAuth, optionalAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
```

### Most Used Patterns

```javascript
// 1. Controller with auth
export const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const user = await User.findById(userId).select('-password');
  res.json({ success: true, data: user });
});

// 2. Create with event
const user = await User.create(userData);
await daprPublisher.publishUserCreated(user, req.correlationId);

// 3. Update with event
const user = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true });
await daprPublisher.publishUserUpdated(user, req.correlationId);

// 4. Error handling
if (!user) {
  return next(new ErrorResponse('User not found', 404, 'USER_NOT_FOUND'));
}
```

---

## Requirements Mapping Table

This table maps PRD requirements to implementation approaches. Use this when implementing features.

| PRD Requirement               | ID      | Implementation Approach                                                       | Files Involved                                              |
| ----------------------------- | ------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **User Registration**         | REQ-1.1 | POST /users endpoint, bcrypt hashing, Mongoose validation, user.created event | `user.controller.js`, `user.model.js`, `daprPublisher.js`   |
| **Profile Retrieval**         | REQ-1.2 | GET /users endpoint with JWT auth, .select('-password'), correlation ID       | `user.controller.js`, `auth.middleware.js`                  |
| **Profile Update**            | REQ-2.1 | PATCH /users endpoint, partial updates, user.updated event, field whitelist   | `user.controller.js`, `user.service.js`                     |
| **Add Address**               | REQ-3.1 | POST /users/addresses, embedded document, default flag logic                  | `user.controller.js`, `address.schema.js`                   |
| **Update Address**            | REQ-3.2 | PATCH /users/addresses/:id, Mongoose subdocument update                       | `user.controller.js`                                        |
| **Delete Address**            | REQ-3.3 | DELETE /users/addresses/:id, subdocument.remove()                             | `user.controller.js`                                        |
| **List Addresses**            | REQ-3.4 | GET /users/addresses, return user.addresses array                             | `user.controller.js`                                        |
| **Add Payment Method**        | REQ-4.1 | POST /users/paymentmethods, PCI-DSS compliance (last 4 digits only)           | `user.controller.js`, `payment.schema.js`                   |
| **Update Payment Method**     | REQ-4.2 | PATCH /users/paymentmethods/:id, Mongoose subdocument update                  | `user.controller.js`                                        |
| **Delete Payment Method**     | REQ-4.3 | DELETE /users/paymentmethods/:id, subdocument.remove()                        | `user.controller.js`                                        |
| **Add to Wishlist**           | REQ-5.1 | POST /users/wishlist, duplicate prevention, timestamp                         | `user.controller.js`, `wishlist.schema.js`                  |
| **Update Wishlist Item**      | REQ-5.2 | PATCH /users/wishlist/:id, update notes/metadata                              | `user.controller.js`                                        |
| **Remove from Wishlist**      | REQ-5.3 | DELETE /users/wishlist/:id, subdocument.remove()                              | `user.controller.js`                                        |
| **Update Preferences**        | REQ-6.1 | PATCH /users, nested object update for preferences                            | `user.controller.js`, `preferences.schema.js`               |
| **Account Deactivation**      | REQ-7.1 | PATCH /users (set isActive: false), user.deactivated event                    | `user.controller.js`                                        |
| **Account Deletion**          | REQ-8.1 | DELETE /users, user.deleted event, GDPR compliance                            | `user.controller.js`                                        |
| **List Users (Admin)**        | REQ-9.1 | GET /admin/users with pagination, requireRole(['admin'])                      | `admin.controller.js`, `role.middleware.js`                 |
| **User Statistics (Admin)**   | REQ-9.2 | GET /admin/users/stats, aggregation pipeline                                  | `admin.controller.js`                                       |
| **Performance (< 100ms p95)** | NFR-1   | MongoDB indexes, field selection, connection pooling                          | `user.model.js`, `database/index.js`                        |
| **Scalability (10M users)**   | NFR-2   | Stateless design, horizontal scaling, no in-memory state                      | All controllers, services                                   |
| **Availability (99.9%)**      | NFR-3   | Health checks, graceful degradation, retry logic                              | `operational.controller.js`                                 |
| **Security (JWT, RBAC)**      | NFR-4   | JWT validation, role middleware, password hashing                             | `auth.middleware.js`, `role.middleware.js`, `user.model.js` |
| **Observability**             | NFR-5   | Winston structured logging, correlation ID, OpenTelemetry                     | `observability/index.js`, `correlationId.middleware.js`     |

---

## Common Copilot Prompts

Use these prompts to accelerate development with GitHub Copilot.

### Feature Implementation

```
"Read docs/PRD.md REQ-3.1 (Add Address).
Implement POST /users/addresses endpoint following docs/ARCHITECTURE.md Controller-Service-Model pattern.
Use .github/copilot-instructions.md embedded document pattern.
Ensure address validation and default flag logic."
```

```
"Read docs/PRD.md REQ-9.2 (User Statistics).
Implement GET /admin/users/stats endpoint with MongoDB aggregation.
Include: total users, active users, new registrations (7d/30d), growth trends.
Use requireRole(['admin']) middleware."
```

### Event Publishing

```
"Add user.email_verified event publisher to daprPublisher.js.
Follow existing publishUserCreated pattern.
Include userId, email, verifiedAt in event data."
```

### Testing

```
"Generate Jest unit tests for createUser controller in user.controller.js.
Mock User model, daprPublisher.
Test cases: success (201), duplicate email (409), validation errors (400).
Use .github/copilot-instructions.md testing patterns."
```

### Migration/Refactoring

```
"Refactor user.controller.js to extract business logic into user.service.js.
Follow docs/ARCHITECTURE.md Service Layer pattern.
Move event publishing, validation, and user creation logic to service."
```

### Code Review

```
"Review this PR against:
1. docs/PRD.md requirements (REQ-3.x)
2. docs/ARCHITECTURE.md patterns
3. .github/copilot-instructions.md conventions
Check: error handling, logging, event publishing, tests."
```

---

## Docker Compose Configuration

**File**: `docker-compose.yml`

```yaml
version: '3.8'

services:
  user-service:
    build:
      context: .
      dockerfile: Dockerfile.api
    ports:
      - '8002:8002'
    environment:
      - NODE_ENV=development
      - PORT=8002
      - MONGODB_HOST=mongodb
      - MONGODB_PORT=27017
      - MONGODB_DB_NAME=user-service-db
      - DAPR_HOST=localhost
      - DAPR_HTTP_PORT=3500
      - PUBSUB_NAME=user-pubsub
      - TOPIC_NAME=user.events
      - LOG_LEVEL=debug
    depends_on:
      - mongodb
      - dapr-sidecar
    networks:
      - xshopai-network
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:8002/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  dapr-sidecar:
    image: daprio/daprd:latest
    command:
      [
        './daprd',
        '-app-id',
        'user-service',
        '-app-port',
        '8002',
        '-dapr-http-port',
        '3500',
        '-components-path',
        '/components',
      ]
    volumes:
      - ./components:/components
    depends_on:
      - rabbitmq
    networks:
      - xshopai-network

  mongodb:
    image: mongo:8.0
    ports:
      - '27017:27017'
    environment:
      - MONGO_INITDB_DATABASE=user-service-db
    volumes:
      - mongodb_data:/data/db
    networks:
      - xshopai-network

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - '5672:5672'
      - '15672:15672'
    networks:
      - xshopai-network

networks:
  xshopai-network:
    driver: bridge

volumes:
  mongodb_data:
```

---

## Environment Setup for Development

### 1. Clone and Install

```bash
git clone https://github.com/xshopai/user-service.git
cd user-service
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
# Server
PORT=8002
NODE_ENV=development

# MongoDB
MONGODB_CONNECTION_SCHEME=mongodb
MONGODB_HOST=localhost
MONGODB_PORT=27017
MONGODB_DB_NAME=user-service-db

# Dapr Configuration
DAPR_HOST=localhost
DAPR_HTTP_PORT=3500
PUBSUB_NAME=user-pubsub
TOPIC_NAME=user.events

# Logging
LOG_LEVEL=debug
LOG_TO_CONSOLE=true
LOG_TO_FILE=false
```

### 3. Start Dependencies

```bash
# Start MongoDB
docker run -d -p 27017:27017 --name mongodb mongo:8.0

# Start RabbitMQ (for Dapr pub/sub backend)
docker run -d -p 5672:5672 -p 15672:15672 --name rabbitmq rabbitmq:3-management

# Start Dapr sidecar (separate terminal)
dapr run --app-id user-service --app-port 8002 --dapr-http-port 3500 --components-path ./components
```

### 4. Run User Service

```bash
npm run dev  # Starts with nodemon (auto-reload)
```

### 5. Verify Setup

```bash
curl http://localhost:8002/health
# Expected: { "status": "healthy", ... }

curl http://localhost:8002/version
# Expected: { "version": "1.0.0", ... }
```

### 6. Run Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### 7. Database Seeding (Optional)

```bash
npm run seed    # Seed test users
npm run clear   # Clear database
```

---

## Advanced Patterns

### Pagination Helper

```javascript
// src/utils/pagination.js
export function paginateResults(query, page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;
  return query.skip(skip).limit(pageSize);
}

// Usage in controller
const users = await paginateResults(User.find({ isActive: true }), req.query.page, req.query.pageSize).sort({
  createdAt: -1,
});
```

### Transaction Support (MongoDB 4.0+)

```javascript
// For multi-document operations
const session = await mongoose.startSession();
session.startTransaction();

try {
  const user = await User.create([{ email, password }], { session });
  const auditLog = await AuditLog.create([{ userId: user._id, action: 'created' }], { session });

  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

### Soft Delete Pattern

```javascript
// Instead of hard delete
await User.findByIdAndUpdate(userId, {
  isDeleted: true,
  deletedAt: new Date(),
  deletedBy: req.user.userId
});

// Add to User schema
deletedAt: { type: Date, default: null },
isDeleted: { type: Boolean, default: false }

// Add index
userSchema.index({ isDeleted: 1 });

// Modify all queries to filter deleted
User.find({ isDeleted: false });
```

### Bulk Operations (Admin)

```javascript
// Bulk user creation
export const bulkCreateUsers = asyncHandler(async (req, res) => {
  const { users } = req.body; // Array of user objects

  const createdUsers = await User.insertMany(users, {
    ordered: false, // Continue on error
  });

  // Publish events for each user
  for (const user of createdUsers) {
    await daprPublisher.publishUserCreated(user, req.correlationId);
  }

  res.status(201).json({
    success: true,
    message: `${createdUsers.length} users created`,
    data: { count: createdUsers.length },
  });
});
```

---

## Performance Tips

### 1. Index Strategy

```javascript
// Create compound indexes for common queries
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ roles: 1, isActive: 1 });
userSchema.index({ createdAt: -1, isActive: 1 });

// Text index for search (future)
userSchema.index({ email: 'text', firstName: 'text', lastName: 'text' });
```

### 2. Field Projection

```javascript
// Only select needed fields
const users = await User.find().select('email firstName lastName roles').lean(); // Convert to plain JS object (faster)
```

### 3. Lean Queries

```javascript
// When you don't need Mongoose document methods
const users = await User.find().lean(); // 5-10x faster
```

### 4. Connection Pooling

```javascript
// In database/index.js
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10, // Max connections
  minPoolSize: 2, // Min connections
  maxIdleTimeMS: 30000, // Close idle connections after 30s
  serverSelectionTimeoutMS: 1002,
});
```

### 5. Query Caching (Future - Redis)

```javascript
// Cache frequently accessed data
const cacheKey = `user:${userId}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const user = await User.findById(userId);
await redis.setex(cacheKey, 300, JSON.stringify(user)); // 5 min TTL
return user;
```

---

## Security Best Practices

### 1. Password Hashing

```javascript
// NEVER store plain text passwords
// Pre-save hook handles this automatically
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12); // Cost factor: 12
  next();
});
```

### 2. PII Redaction in Logs

```javascript
// NEVER log sensitive data
logger.info('User created', null, {
  userId: user._id,
  email: user.email, // OK - business identifier
  // password: user.password  ❌ NEVER
  // creditCard: payment.cardNumber  ❌ NEVER
  correlationId: req.correlationId,
});
```

### 3. Input Sanitization

```javascript
// Sanitize user input to prevent injection
import mongoSanitize from 'express-mongo-sanitize';

app.use(mongoSanitize()); // Remove $ and . from user input
```

### 4. Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

const createAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many accounts created, please try again later',
});

router.post('/users', createAccountLimiter, createUser);
```

### 5. CORS Configuration

```javascript
import cors from 'cors';

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  }),
);
```

---

## Troubleshooting Guide

### Issue: MongoDB Connection Failed

**Symptoms**: Service crashes on startup with "MongoNetworkError"

**Solution**:

```bash
# Check MongoDB is running
docker ps | grep mongo

# Check connection string
echo $MONGODB_HOST

# Test connection manually
mongosh mongodb://localhost:27017/user-service-db
```

### Issue: Event Publishing Fails

**Symptoms**: "Failed to publish event" in logs, but operation succeeds

**Solution**: This is expected (graceful degradation). Check Dapr sidecar:

```bash
curl http://localhost:3500/v1.0/healthz
```

### Issue: JWT Validation Fails

**Symptoms**: 401 Unauthorized on authenticated endpoints

**Solution**:

```bash
# Decode JWT to check payload
jwt decode <token>

# Verify JWT has userId, email, roles fields
# Ensure auth-service is issuing correct JWT format
```

### Issue: Duplicate Email Error (409) When It Shouldn't Exist

**Symptoms**: POST /users returns 409 for new email

**Solution**:

```bash
# Check for orphaned user
mongosh
use user-service-db
db.users.findOne({ email: "problematic@email.com" })

# If found and shouldn't exist, delete it
db.users.deleteOne({ email: "problematic@email.com" })
```

### Issue: Slow Queries

**Symptoms**: Response time > 200ms consistently

**Solution**:

```javascript
// Enable Mongoose debug mode
mongoose.set('debug', true);

// Check indexes
db.users.getIndexes();

// Add missing indexes
userSchema.index({ isActive: 1, createdAt: -1 });
```

---

**Remember**: User-service is a **foundational service** - keep it simple, reliable, and focused on user data management. All event communication goes through Dapr Pub/Sub, never directly to message brokers.
