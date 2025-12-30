# User Service - Technical Architecture

> **Service**: User Service  
> **Version**: 1.0  
> **Last Updated**: November 4, 2025  
> **Status**: Active Development

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Architecture Layers](#architecture-layers)
- [Code Structure](#code-structure)
- [Design Patterns](#design-patterns)
- [Data Layer](#data-layer)
- [Event-Driven Architecture](#event-driven-architecture)
- [API Layer](#api-layer)
- [Error Handling](#error-handling)
- [Authentication & Authorization](#authentication--authorization)
- [Caching Strategy](#caching-strategy)
- [Testing Strategy](#testing-strategy)
- [Performance Optimization](#performance-optimization)

---

## Overview

User Service is the **foundational identity and profile management service** in the xShop.ai platform. It follows a **layered architecture** pattern with clear separation of concerns and implements **event-driven integration** using Dapr Pub/Sub for asynchronous communication.

### Service Responsibilities

1. **User Management**: CRUD operations for user accounts
2. **Profile Management**: User profiles, addresses, payment methods, wishlists
3. **Event Publishing**: Notify other services of user lifecycle changes via Dapr
4. **Administrative Operations**: User statistics, bulk operations, support tools
5. **Data Privacy**: GDPR-compliant data management and deletion

### Architecture Principles

- **Layered Architecture**: Controller → Service → Model
- **Pure Publisher Pattern**: Publishes events, doesn't consume them
- **Repository Pattern**: Abstract data access layer (Mongoose ODM)
- **Dependency Injection**: Loose coupling via service layer
- **Dapr Abstraction**: Event bus abstraction via Dapr SDK
- **Stateless Design**: Horizontal scalability
- **Security First**: JWT validation, RBAC, password hashing

---

## Technology Stack

### Runtime & Language

- **Node.js**: v18+ LTS
- **JavaScript**: ES6+ modules (no TypeScript currently)
- **npm**: Package management

### Web Framework

- **Express**: v5.1.0 (async routes support)
- **cors**: Cross-origin resource sharing
- **helmet**: Security headers
- **express-rate-limit**: Rate limiting middleware

### Database

- **MongoDB**: v8.18.0 (document database)
- **Mongoose**: v8.8.4 (ODM with schema validation)
- **Connection**: MongoDB Atlas (cloud) or local MongoDB
- **Pooling**: Connection pooling built into Mongoose

### Event System

- **Dapr SDK for Node.js**: Event pub/sub abstraction
- **@dapr/dapr**: Official Dapr SDK for Node.js
- **RabbitMQ**: Message broker (behind Dapr)
- **Topics**: `user.events`
- **No direct RabbitMQ/Kafka**: All events via Dapr Pub/Sub API

### Validation & Serialization

- **Custom Validators**: Email, phone, password validation
- **Mongoose Validation**: Schema-level validation
- **express-validator**: Request validation middleware (optional)

### Security

- **bcryptjs**: Password hashing (cost factor: 12)
- **jsonwebtoken**: JWT parsing (validation done by auth-service)
- **helmet**: Security headers
- **express-rate-limit**: DDoS protection

### Logging & Monitoring

- **Winston**: Structured JSON logging
- **winston-daily-rotate-file**: Log rotation
- **Correlation ID Middleware**: Request tracing
- **Morgan**: HTTP request logging (development)

### Testing

- **Jest**: Unit and integration testing
- **Supertest**: HTTP API testing
- **node-mocks-http**: Mock Express req/res
- **mongodb-memory-server**: In-memory MongoDB for tests
- **faker**: Test data generation

### Development Tools

- **nodemon**: Auto-reload during development
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Babel**: ES6+ transpilation for tests

---

## Architecture Layers

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (HTTP)                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │  Routers   │  │ Middlewares│  │ Controllers│            │
│  │ (Express)  │  │(Auth, RBAC)│  │(Async      │            │
│  │            │  │            │  │ Handlers)  │            │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘            │
└────────┼────────────────┼────────────────┼───────────────────┘
         │                │                │
         └────────────────┴────────────────┘
                          │
┌─────────────────────────┼─────────────────────────────────────┐
│                   Service Layer (Business Logic)              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │ User Service   │  │ Address Service│  │ Cache Service  │ │
│  │  (Domain Logic)│  │                │  │  (Future)      │ │
│  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘ │
└───────────┼──────────────────────┼──────────────────┼─────────┘
            │                      │                  │
            └──────────────────────┴──────────────────┘
                                   │
┌───────────────────────────────────┼──────────────────────────┐
│                  Data Access Layer (Models & Events)         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐│
│  │User Model      │  │ Dapr Publisher │  │ Sub-Schemas    ││
│  │  (Mongoose)    │  │ (Event Pub)    │  │(Address, etc.) ││
│  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘│
└───────────┼──────────────────────┼──────────────────┼────────┘
            │                      │                  │
            ▼                      ▼                  ▼
      ┌──────────┐          ┌──────────┐      ┌──────────┐
      │ MongoDB  │          │   Dapr   │      │  Redis   │
      │ (Primary)│          │(Pub/Sub) │      │ (Future) │
      └──────────┘          └──────────┘      └──────────┘
                                   │
                                   ▼
                            ┌──────────┐
                            │ RabbitMQ │
                            │(Backend) │
                            └──────────┘
```

### Layer Responsibilities

#### 1. API Layer (`src/routes/`, `src/controllers/`, `src/middlewares/`)

- **Routers**: Define Express route endpoints and HTTP methods
- **Controllers**: Handle requests, validation, response formatting
- **Middlewares**: Authentication, authorization, logging, error handling, CORS

#### 2. Service Layer (`src/services/`)

- **Business Logic**: User creation rules, validation, workflows
- **Domain Events**: Trigger event publishing on state changes
- **Orchestration**: Coordinate multiple operations

#### 3. Data Access Layer (`src/models/`, `src/schemas/`, `src/services/daprPublisher.js`)

- **Models**: Mongoose models with schema definitions
- **Sub-Schemas**: Embedded documents (addresses, payment methods, etc.)
- **Event Publisher**: Publish domain events via Dapr SDK (external I/O)

#### 4. Infrastructure

- **MongoDB**: Primary data store
- **Dapr Sidecar**: Pub/Sub abstraction
- **RabbitMQ**: Message broker backend (via Dapr)
- **Redis**: Future caching layer

---

### Layer 1: API Layer (Routes & Controllers)

**Purpose**: Handle HTTP requests, validate input, return responses

```
src/routes/           → Route definitions
src/controllers/      → Request handlers
src/middlewares/      → Express middleware (auth, error, correlation ID)
```

**Responsibilities**:

- Route mapping (`/users`, `/admin`, `/health`)
- Request validation
- Authentication/authorization checks
- Response formatting
- Error handling delegation

**Key Files**:

- `routes/user.routes.js` - User-facing endpoints
- `routes/admin.routes.js` - Admin endpoints
- `routes/operational.routes.js` - Health checks, metrics
- `controllers/user.controller.js` - User CRUD operations
- `controllers/admin.controller.js` - Admin operations

### Layer 2: Business Logic Layer (Services)

**Purpose**: Core business logic, orchestration, external communication

```
src/services/
├── user.service.js          → User business logic
├── daprPublisher.js         → Dapr event publishing
└── (future) cacheService.js → Redis caching via Dapr State Store
```

**Responsibilities**:

- Business rules enforcement
- Orchestration of multiple operations
- Event publishing
- External service communication
- Transaction coordination

**Key Patterns**:

```javascript
// Service exports functions, not classes
export async function createUser(userData, correlationId) {
  // Business logic here
}
```

### Layer 3: Data Access Layer (Models & Schemas)

**Purpose**: Database operations, data validation, schema definition

```
src/models/           → Mongoose models
src/schemas/          → Sub-schemas (embedded documents)
```

**Responsibilities**:

- Schema definition
- Data validation
- Pre/post hooks (e.g., password hashing)
- Database queries
- Index management

**Key Files**:

- `models/user.model.js` - User collection schema
- `schemas/address.schema.js` - Address sub-schema
- `schemas/payment.schema.js` - Payment method sub-schema
- `schemas/wishlist.schema.js` - Wishlist item sub-schema
- `schemas/preferences.schema.js` - User preferences sub-schema

### Layer 4: Cross-Cutting Concerns

**Purpose**: Logging, monitoring, utilities

```
src/observability/    → Winston logger, tracing
src/utils/            → Helper functions
src/validators/       → Custom validation logic
```

---

## Code Structure

```
user-service/
├── src/
│   ├── controllers/              # Request handlers
│   │   ├── user.controller.js       # User CRUD
│   │   ├── admin.controller.js      # Admin operations
│   │   └── operational.controller.js # Health/metrics
│   ├── database/                 # MongoDB connection
│   │   └── index.js                 # Connection setup
│   ├── middlewares/              # Express middleware
│   │   ├── auth.middleware.js       # JWT validation
│   │   ├── role.middleware.js       # RBAC
│   │   ├── correlationId.middleware.js
│   │   ├── error.middleware.js      # Global error handler
│   │   └── asyncHandler.js          # Async route wrapper
│   ├── models/                   # Mongoose models
│   │   └── user.model.js            # User schema
│   ├── observability/            # Logging & tracing
│   │   └── index.js                 # Winston logger
│   ├── routes/                   # Route definitions
│   │   ├── user.routes.js           # User endpoints
│   │   ├── admin.routes.js          # Admin endpoints
│   │   └── operational.routes.js    # Health/metrics
│   ├── schemas/                  # Sub-schemas
│   │   ├── address.schema.js        # Address sub-document
│   │   ├── payment.schema.js        # Payment method sub-document
│   │   ├── wishlist.schema.js       # Wishlist item sub-document
│   │   └── preferences.schema.js    # User preferences sub-document
│   ├── services/                 # Business logic
│   │   ├── user.service.js          # User operations
│   │   └── daprPublisher.js         # Dapr event publishing
│   ├── types/                    # JSDoc type definitions
│   │   └── index.js                 # Shared types
│   ├── utils/                    # Utilities
│   │   ├── ErrorResponse.js         # Custom error class
│   │   └── correlation.js           # Correlation ID generation
│   ├── validators/               # Custom validators
│   │   ├── user.validator.js        # User validation
│   │   └── address.validator.js     # Address validation
│   ├── app.js                    # Express app setup
│   └── server.js                 # Server entry point
├── tests/                        # Test files
│   ├── unit/                        # Unit tests
│   ├── integration/                 # Integration tests
│   └── fixtures/                    # Test data
├── .env                          # Environment variables
├── .dockerignore                 # Docker ignore rules
├── Dockerfile.api                # Docker image definition
├── docker-compose.yml            # Local development setup
├── package.json                  # Dependencies
├── jest.config.js                # Jest configuration
├── babel.config.json             # Babel configuration
└── README.md                     # Getting started guide
```

---

## Design Patterns

### 1. Controller-Service-Model Pattern

**Controllers** handle HTTP concerns, **Services** contain business logic, **Models** handle data access.

```javascript
// Controller (user.controller.js)
export const createUser = asyncHandler(async (req, res, next) => {
  const { email, password, firstName, lastName } = req.body;

  // Delegate to service layer
  const user = await userService.createUser(
    {
      email,
      password,
      firstName,
      lastName,
    },
    req.correlationId,
    req.ip,
    req.get('user-agent')
  );

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: { userId: user._id, email: user.email },
  });
});

// Service (user.service.js)
export async function createUser(userData, correlationId, ipAddress, userAgent) {
  // Business logic
  const user = await User.create(userData);

  // Publish event
  await daprPublisher.publishUserCreated(user, correlationId, ipAddress, userAgent);

  return user;
}

// Model (user.model.js)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

export default mongoose.model('User', userSchema);
```

### 2. Repository Pattern (Mongoose ODM)

Mongoose acts as our repository, abstracting database operations.

```javascript
// Instead of raw MongoDB queries
const user = await db.collection('users').findOne({ email });

// We use Mongoose models
const user = await User.findOne({ email });
```

### 3. Middleware Chain Pattern

Express middleware for cross-cutting concerns:

```javascript
// Route with middleware chain
router.get(
  '/profile',
  requireAuth, // JWT validation
  requireRole(['customer']), // RBAC
  getProfile // Controller
);
```

### 4. Error Handling Pattern

Centralized error handling with custom `ErrorResponse` class:

```javascript
// Throw custom errors anywhere
throw new ErrorResponse('User not found', 404, 'USER_NOT_FOUND');

// Global error middleware catches and formats
app.use(errorHandler);
```

### 5. Async Handler Pattern

Wraps async routes to avoid try/catch boilerplate:

```javascript
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Usage
export const createUser = asyncHandler(async (req, res) => {
  // No try/catch needed - errors automatically caught
});
```

---

## Data Layer

### Mongoose Schemas

#### User Schema (Primary)

```javascript
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import addressSchema from '../schemas/address.schema.js';
import paymentSchema from '../schemas/payment.schema.js';
import wishlistSchema from '../schemas/wishlist.schema.js';
import preferencesSchema from '../schemas/preferences.schema.js';

const userSchema = new mongoose.Schema(
  {
    // Authentication
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
      index: true, // Index for fast lookups
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      maxlength: 100,
      select: false, // Never return password by default
    },

    // Profile
    firstName: { type: String, maxlength: 50, trim: true },
    lastName: { type: String, maxlength: 50, trim: true },
    phoneNumber: { type: String, maxlength: 20, trim: true },

    // Authorization
    roles: {
      type: [String],
      enum: ['customer', 'admin'],
      default: ['customer'],
    },

    // Account status
    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    // Embedded documents
    addresses: [addressSchema],
    paymentMethods: [paymentSchema],
    wishlist: [wishlistSchema],
    preferences: {
      type: preferencesSchema,
      default: () => ({}), // Create default preferences
    },

    // Audit fields
    createdBy: { type: String, default: 'SELF_REGISTRATION' },
    updatedBy: { type: String },
  },
  {
    timestamps: true, // Auto-create createdAt, updatedAt
    collection: 'users',
  }
);

// Pre-save hook: Hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Instance method: Compare password (used by auth-service)
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Indexes for performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ isActive: 1 });
userSchema.index({ roles: 1 });
userSchema.index({ createdAt: -1 });

export default mongoose.model('User', userSchema);
```

#### Address Sub-Schema

```javascript
import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['shipping', 'billing'],
    required: true,
  },
  isDefault: { type: Boolean, default: false },
  fullName: { type: String, required: true, maxlength: 100 },
  addressLine1: { type: String, required: true, maxlength: 200 },
  addressLine2: { type: String, maxlength: 200 },
  city: { type: String, required: true, maxlength: 100 },
  state: { type: String, required: true, maxlength: 100 },
  postalCode: { type: String, required: true, maxlength: 20 },
  country: { type: String, required: true, maxlength: 100 },
  phoneNumber: { type: String, maxlength: 20 },
});

export default addressSchema;
```

### Database Operations

#### Create User

```javascript
const user = await User.create({
  email: 'john@example.com',
  password: 'SecurePass123', // Will be hashed by pre-save hook
  firstName: 'John',
  lastName: 'Doe',
});
```

#### Find User

```javascript
// By email
const user = await User.findOne({ email: 'john@example.com' });

// By ID
const user = await User.findById(userId);

// Exclude password
const user = await User.findById(userId).select('-password');
```

#### Update User

```javascript
const user = await User.findByIdAndUpdate(
  userId,
  { firstName: 'Jonathan', phoneNumber: '+1-555-9999' },
  { new: true, runValidators: true } // Return updated doc, run validators
);
```

#### Add Address

```javascript
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
```

#### Remove Address

```javascript
user.addresses.id(addressId).remove();
await user.save();
```

### Database Indexes

```javascript
// Created automatically by Mongoose
{ email: 1 } - unique index for fast email lookups
{ isActive: 1 } - filter active/inactive users
{ roles: 1 } - RBAC queries
{ createdAt: -1 } - recent users, pagination
```

---

## Event-Driven Architecture

### Event Publishing Pattern

User Service publishes events to notify other services of state changes via Dapr Pub/Sub.

```
┌─────────────────┐
│  User Service   │
│  + Dapr Sidecar │
└────────┬────────┘
         │ Dapr Pub/Sub API
         ▼
┌──────────────────────┐
│ Dapr Runtime         │
│ (Pub/Sub Component)  │
└──────────┬───────────┘
           │ AMQP
           ▼
┌──────────────────────┐
│ RabbitMQ             │
└──────────────────────┘
           │
           └──► notification-service (send welcome email)
           └──► audit-service (log user creation)
           └──► auth-service (cache user data)
```

### Dapr Publisher Client

**File**: `src/services/daprPublisher.js`

```javascript
import { DaprClient } from '@dapr/dapr';
import logger from '../observability/index.js';

const DAPR_HOST = process.env.DAPR_HOST || 'localhost';
const DAPR_HTTP_PORT = process.env.DAPR_HTTP_PORT || '3500';
const PUBSUB_NAME = process.env.PUBSUB_NAME || 'user-pubsub';
const TOPIC_NAME = process.env.TOPIC_NAME || 'user.events';

// Initialize Dapr client
const daprClient = new DaprClient({ daprHost: DAPR_HOST, daprPort: DAPR_HTTP_PORT });

/**
 * Publish user.created event
 */
export async function publishUserCreated(user, correlationId, ipAddress, userAgent) {
  const event = {
    source: 'user-service',
    eventType: 'user.created',
    eventVersion: '1.0',
    eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    timestamp: new Date().toISOString(),
    correlationId,
    data: {
      userId: user._id.toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      createdAt: user.createdAt,
    },
    metadata: {
      environment: process.env.NODE_ENV,
      ipAddress,
      userAgent,
    },
  };

  return await publishEvent(event);
}

/**
 * Publish user.updated event
 */
export async function publishUserUpdated(user, correlationId, updatedBy, ipAddress, userAgent) {
  const event = {
    source: 'user-service',
    eventType: 'user.updated',
    eventVersion: '1.0',
    eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    timestamp: new Date().toISOString(),
    correlationId,
    data: {
      userId: user._id.toString(),
      email: user.email,
      updatedBy,
      updatedAt: user.updatedAt,
    },
    metadata: {
      environment: process.env.NODE_ENV,
      ipAddress,
      userAgent,
    },
  };

  return await publishEvent(event);
}

/**
 * Generic event publisher using Dapr Pub/Sub
 */
async function publishEvent(event) {
  try {
    await daprClient.pubsub.publish(PUBSUB_NAME, TOPIC_NAME, event);

    logger.info('Event published successfully', null, {
      operation: 'publish_event',
      eventType: event.eventType,
      eventId: event.eventId,
      correlationId: event.correlationId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to publish event', null, {
      operation: 'publish_event',
      eventType: event.eventType,
      error: error.message,
      correlationId: event.correlationId,
    });

    // Graceful degradation - don't fail the request
    return null;
  }
}

export default {
  publishUserCreated,
  publishUserUpdated,
};
        'X-Correlation-ID': event.correlationId,
      },
      timeout: 1002, // 5 second timeout
    });

    logger.info('Event published successfully', null, {
      operation: 'publish_event',
      eventType: event.eventType,
      eventId: event.eventId,
      correlationId: event.correlationId,
    });

    return response.data;
  } catch (error) {
    logger.error('Failed to publish event', null, {
      operation: 'publish_event',
      eventType: event.eventType,
      error: error.message,
      correlationId: event.correlationId,
    });

    // Graceful degradation - don't fail the request
    return null;
  }
}

export default {
  publishUserCreated,
  publishUserUpdated,
};
```

### Event Types Published

| Event Type         | Trigger              | Data                               | Consumers                                 |
| ------------------ | -------------------- | ---------------------------------- | ----------------------------------------- |
| `user.created`     | User registration    | userId, email, firstName, lastName | notification (welcome email), audit, auth |
| `user.updated`     | Profile update       | userId, updatedBy, changes         | audit, auth (cache invalidation)          |
| `user.deleted`     | Account deletion     | userId, email                      | audit, notification, auth, order, review  |
| `user.deactivated` | Account deactivation | userId, reason                     | auth (revoke tokens), audit               |
| `user.reactivated` | Account reactivation | userId                             | auth, audit                               |

### Event Format (AWS EventBridge Style)

```javascript
{
  source: 'user-service',           // Service that published the event
  eventType: 'user.created',        // Event type
  eventVersion: '1.0',              // Event schema version
  eventId: 'evt-123-xyz',           // Unique event ID
  timestamp: '2025-11-04T10:30:00Z', // ISO 8601 timestamp
  correlationId: 'corr-abc-def',    // Distributed tracing ID
  data: {                           // Event payload
    userId: '507f1f77bcf86cd799439011',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe'
  },
  metadata: {                       // Context metadata
    environment: 'production',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...'
  }
}
```

### Service-to-Service Communication (Dapr Service Invocation)

User Service is called by other internal services using **Dapr Service Invocation** building block for synchronous request-response patterns.

#### Architecture Pattern

```
┌─────────────────┐                    ┌─────────────────┐
│  Auth Service   │                    │  User Service   │
│  + Dapr Sidecar │                    │  + Dapr Sidecar │
└────────┬────────┘                    └────────▲────────┘
         │                                      │
         │ 1. Invoke user-service              │
         │    GET /users/findByEmail           │
         ▼                                      │
┌──────────────────────┐              ┌──────────────────────┐
│ Dapr Runtime (Auth)  │──── HTTP ───►│ Dapr Runtime (User)  │
│ Service Invocation   │              │ Service Invocation   │
└──────────────────────┘              └──────────────────────┘
         │                                      │
         │ 2. Service Discovery                 │ 3. Forward to App
         │    (find user-service)               │    localhost:1002
         │                                      │
         └──────────────────────────────────────┘
                    4. Return Response
```

#### Inbound Service Invocation (User Service as Receiver)

**Callers**: auth-service, order-service, admin-service, etc.

**Endpoints exposed for service invocation**:

```javascript
// src/routes/user.routes.js
import express from 'express';
const router = express.Router();

// Internal API for service-to-service calls
// Called by auth-service during login
router.get(
  '/findByEmail',
  asyncHandler(async (req, res) => {
    const { email } = req.query;

    const user = await User.findOne({ email }).select('-password');

    if (!user) {
      throw new ErrorResponse('User not found', 404);
    }

    res.json({ success: true, data: user });
  })
);

// Called by order-service to get user details
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      throw new ErrorResponse('User not found', 404);
    }

    res.json({ success: true, data: user });
  })
);
```

**Note**: No special code changes needed in user-service. Dapr handles the invocation transparently.

#### Outbound Service Invocation (User Service as Caller)

**Future Use Case**: If user-service needs to call other services (not currently implemented)

```javascript
// Example: Call auth-service to validate token (hypothetical)
import { DaprClient, HttpMethod } from '@dapr/dapr';

const daprClient = new DaprClient({
  daprHost: process.env.DAPR_HOST || 'localhost',
  daprPort: process.env.DAPR_HTTP_PORT || '3500',
});

async function validateToken(token) {
  try {
    const response = await daprClient.invoker.invoke(
      'auth-service', // Target service app-id
      'auth/validate', // Endpoint path
      HttpMethod.POST, // HTTP method
      { token } // Request body
    );

    return response;
  } catch (error) {
    logger.error('Failed to validate token via Dapr', error);
    throw error;
  }
}
```

#### Benefits of Dapr Service Invocation

1. **Service Discovery**: No need to hard-code URLs (e.g., `http://user-service:1002`)
2. **mTLS**: Automatic mutual TLS encryption between services
3. **Retries**: Built-in retry logic with exponential backoff
4. **Timeouts**: Configurable timeout handling
5. **Observability**: Distributed tracing via OpenTelemetry
6. **Resiliency**: Circuit breakers and bulkheads
7. **Load Balancing**: Automatic load distribution across instances

#### Configuration

**Dapr Sidecar**:

```yaml
# components/pubsub.yaml (already configured)
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: user-pubsub
spec:
  type: pubsub.rabbitmq
  # ...
```

**No additional configuration needed** for service invocation - it works out of the box with Dapr sidecars.

#### Service Invocation vs Pub/Sub

| Pattern                | Use Case                        | Example                                                  |
| ---------------------- | ------------------------------- | -------------------------------------------------------- |
| **Service Invocation** | Synchronous request-response    | auth-service → user-service (GET /users/findByEmail)     |
| **Pub/Sub**            | Asynchronous event notification | user-service → notification-service (user.created event) |

**When to use Service Invocation**:

- Need immediate response
- Direct service dependency is acceptable
- CRUD operations (GET, POST, PUT, DELETE)
- Validation/authorization checks

**When to use Pub/Sub**:

- Fire-and-forget notifications
- Multiple consumers for same event
- Decoupled architecture
- Event-driven workflows

---

## API Layer

### Request Flow

```
1. HTTP Request → Express Router
2. Correlation ID Middleware (generate/extract correlation ID)
3. Auth Middleware (validate JWT, populate req.user)
4. Role Middleware (check RBAC permissions)
5. Controller (validate input, call service)
6. Service Layer (business logic, event publishing)
7. Model Layer (database operations)
8. Response Formatter
9. HTTP Response
```

### Controller Pattern

```javascript
import asyncHandler from '../middlewares/asyncHandler.js';
import ErrorResponse from '../utils/ErrorResponse.js';
import User from '../models/user.model.js';
import daprPublisher from '../services/daprPublisher.js';
import logger from '../observability/index.js';

/**
 * @desc    Create new user
 * @route   POST /users
 * @access  Public
 */
export const createUser = asyncHandler(async (req, res, next) => {
  const { email, password, firstName, lastName, phoneNumber } = req.body;

  // 1. Validation
  if (!email) {
    return next(new ErrorResponse('Email is required', 400, 'EMAIL_REQUIRED'));
  }

  if (!password) {
    return next(new ErrorResponse('Password is required', 400, 'PASSWORD_REQUIRED'));
  }

  // 2. Check if user exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return next(new ErrorResponse('Email already registered', 409, 'EMAIL_EXISTS'));
  }

  // 3. Create user
  const user = await User.create({
    email: email.toLowerCase(),
    password,
    firstName,
    lastName,
    phoneNumber,
    roles: ['customer'],
  });

  // 4. Publish event (graceful degradation if fails)
  await daprPublisher.publishUserCreated(user, req.correlationId, req.ip, req.get('user-agent'));

  // 5. Log success
  logger.info('User created successfully', null, {
    operation: 'create_user',
    userId: user._id.toString(),
    email: user.email,
    correlationId: req.correlationId,
  });

  // 6. Response
  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: {
      userId: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
  });
});
```

### Route Definition

```javascript
import express from 'express';
import { requireAuth, optionalAuth } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { createUser, getProfile, updateProfile, deleteAccount } from '../controllers/user.controller.js';

const router = express.Router();

// Public routes
router.post('/users', createUser);
router.get('/users/findByEmail', findUserByEmail);

// Protected routes (requires JWT)
router.get('/users', requireAuth, getProfile);
router.patch('/users', requireAuth, updateProfile);
router.delete('/users', requireAuth, deleteAccount);

// Admin-only routes
router.get('/admin/users', requireAuth, requireRole(['admin']), listUsers);
router.get('/admin/users/stats', requireAuth, requireRole(['admin']), getUserStats);

export default router;
```

---

## Error Handling

### ErrorResponse Class

```javascript
// src/utils/ErrorResponse.js
class ErrorResponse extends Error {
  constructor(message, statusCode, errorCode = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export default ErrorResponse;
```

### Global Error Handler Middleware

```javascript
// src/middlewares/error.middleware.js
export const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.errorCode = err.errorCode || 'INTERNAL_ERROR';

  // Mongoose duplicate key error
  if (err.code === 11000) {
    error.message = 'Duplicate field value entered';
    error.statusCode = 409;
    error.errorCode = 'DUPLICATE_KEY';
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    error.message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
    error.statusCode = 400;
    error.errorCode = 'VALIDATION_ERROR';
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    error.message = 'Invalid ID format';
    error.statusCode = 400;
    error.errorCode = 'INVALID_ID';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token';
    error.statusCode = 401;
    error.errorCode = 'INVALID_TOKEN';
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Token expired';
    error.statusCode = 401;
    error.errorCode = 'TOKEN_EXPIRED';
  }

  // Log error
  logger.error('Request error', null, {
    operation: 'error_handler',
    error: error.message,
    stack: err.stack,
    statusCode: error.statusCode,
    errorCode: error.errorCode,
    correlationId: req.correlationId,
  });

  // Response
  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    errorCode: error.errorCode,
    correlationId: req.correlationId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
```

---

## Authentication & Authorization

### JWT Validation Middleware

```javascript
// src/middlewares/auth.middleware.js
import jwt from 'jsonwebtoken';
import ErrorResponse from '../utils/ErrorResponse.js';
import asyncHandler from './asyncHandler.js';

/**
 * Require authentication
 */
export const requireAuth = asyncHandler(async (req, res, next) => {
  let token;

  // Extract token from Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ErrorResponse('Authentication required', 401, 'UNAUTHORIZED'));
  }

  try {
    // Decode JWT (auth-service already validated it)
    const decoded = jwt.decode(token);

    if (!decoded) {
      return next(new ErrorResponse('Invalid token', 401, 'INVALID_TOKEN'));
    }

    // Populate req.user with JWT payload
    req.user = {
      userId: decoded.userId || decoded.sub,
      email: decoded.email,
      roles: decoded.roles || [],
    };

    next();
  } catch (error) {
    return next(new ErrorResponse('Token validation failed', 401, 'INVALID_TOKEN'));
  }
});

/**
 * Optional authentication (works with or without token)
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];

    try {
      const decoded = jwt.decode(token);
      if (decoded) {
        req.user = {
          userId: decoded.userId || decoded.sub,
          email: decoded.email,
          roles: decoded.roles || [],
        };
      }
    } catch (error) {
      // Ignore token errors for optional auth
    }
  }

  next();
});
```

### Role-Based Access Control (RBAC)

```javascript
// src/middlewares/role.middleware.js
import ErrorResponse from '../utils/ErrorResponse.js';

/**
 * Require specific role(s)
 */
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ErrorResponse('Authentication required', 401, 'UNAUTHORIZED'));
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return next(new ErrorResponse('Insufficient permissions', 403, 'FORBIDDEN'));
    }

    next();
  };
};
```

### Usage in Routes

```javascript
// Public endpoint
router.post('/users', createUser);

// Requires authentication
router.get('/users', requireAuth, getProfile);

// Requires admin role
router.get('/admin/users', requireAuth, requireRole(['admin']), listUsers);

// Requires customer OR admin role
router.post('/users/wishlist', requireAuth, requireRole(['customer', 'admin']), addToWishlist);
```

---

## Caching Strategy

### Read-Through Cache (Future Enhancement)

**Current State**: No caching (direct MongoDB queries)

**Planned**: Redis caching for frequently accessed user profiles

```javascript
import { createClient } from 'redis';

// Cache configuration
const CACHE_TTL = 5 * 60; // 5 minutes

// Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
});

await redisClient.connect();

// Cache key pattern
function getCacheKey(userId) {
  return `user:${userId}`;
}

// Read-through cache
async function getUserById(id) {
  // 1. Check cache
  const cacheKey = getCacheKey(id);
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // 2. Query database
  const user = await User.findById(id).select('-password');
  if (!user) {
    return null;
  }

  // 3. Store in cache
  await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(user));
  return user;
}

// Cache invalidation on update
async function updateUser(id, updates) {
  const user = await User.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true }).select(
    '-password'
  );

  // Invalidate cache
  await redisClient.del(getCacheKey(id));

  return user;
}

// Cache invalidation on delete
async function deleteUser(id) {
  await User.findByIdAndDelete(id);

  // Invalidate cache
  await redisClient.del(getCacheKey(id));
}
```

### Cache Patterns

**Cache-Aside (Lazy Loading)**:

```javascript
// Used for user profile retrieval
export async function getUserProfile(userId) {
  // Check cache first
  const cached = await cache.get(`user:${userId}`);
  if (cached) return JSON.parse(cached);

  // Cache miss - query DB
  const user = await User.findById(userId).select('-password');

  // Populate cache
  if (user) {
    await cache.setEx(`user:${userId}`, 300, JSON.stringify(user));
  }

  return user;
}
```

**Write-Through**:

```javascript
// Used for user updates
export async function updateUserProfile(userId, updates) {
  // Update database
  const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true, runValidators: true }).select(
    '-password'
  );

  // Update cache immediately
  await cache.setEx(`user:${userId}`, 300, JSON.stringify(user));

  return user;
}
```

**Cache Invalidation Strategy**:

```javascript
// Invalidate on mutations
export async function invalidateUserCache(userId) {
  const cacheKeys = [
    `user:${userId}`, // User profile
    `user:${userId}:addresses`, // User addresses
    `user:${userId}:paymentMethods`, // Payment methods
    `user:${userId}:wishlist`, // Wishlist items
  ];

  await Promise.all(cacheKeys.map((key) => cache.del(key)));
}

// Call after any mutation
await User.findByIdAndUpdate(userId, updates);
await invalidateUserCache(userId);
await daprPublisher.publishUserUpdated(user);
```

### Caching Considerations

**What to Cache**:

- ✅ User profiles (read-heavy)
- ✅ User addresses (read-heavy)
- ✅ User preferences (read-heavy)
- ❌ Authentication tokens (security risk)
- ❌ Passwords (security risk)
- ❌ Payment methods (PCI-DSS compliance)

**Cache Invalidation Events**:

- Profile update → Invalidate `user:{userId}`
- Address added/updated → Invalidate `user:{userId}:addresses`
- Wishlist updated → Invalidate `user:{userId}:wishlist`
- User deletion → Invalidate all user-related keys

**TTL Guidelines**:

- User profiles: 5 minutes
- User addresses: 10 minutes
- User preferences: 15 minutes
- Wishlist: 2 minutes (more dynamic)

---

## Testing Strategy

### Test Structure

```
tests/
├── unit/                        # Unit tests
│   ├── controllers/                # Controller tests
│   ├── services/                   # Service tests
│   ├── models/                     # Model tests
│   └── utils/                      # Utility tests
├── integration/                 # Integration tests
│   ├── auth.test.js                # Auth flow tests
│   ├── user-crud.test.js           # User CRUD tests
│   └── event-publishing.test.js    # Event tests
└── fixtures/                    # Test data
    └── users.js                    # Sample user data
```

### Unit Testing

**Test**: Controller

```javascript
import { createUser } from '../../src/controllers/user.controller.js';
import User from '../../src/models/user.model.js';
import daprPublisher from '../../src/services/daprPublisher.js';

jest.mock('../../src/models/user.model.js');
jest.mock('../../src/services/daprPublisher.js');

describe('createUser Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: { email: 'test@example.com', password: 'Pass123' },
      correlationId: 'test-corr-id',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-agent'),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it('should create user and return 201', async () => {
    const mockUser = {
      _id: 'user-123',
      email: 'test@example.com',
      roles: ['customer'],
    };

    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue(mockUser);
    daprPublisher.publishUserCreated.mockResolvedValue({ success: true });

    await createUser(req, res, next);

    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'test@example.com',
        password: 'Pass123',
      })
    );
    expect(daprPublisher.publishUserCreated).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ userId: 'user-123' }),
      })
    );
  });

  it('should return 409 if email exists', async () => {
    User.findOne.mockResolvedValue({ email: 'test@example.com' });

    await createUser(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        errorCode: 'EMAIL_EXISTS',
      })
    );
  });
});
```

### Integration Testing

**Test**: Full API flow

```javascript
import request from 'supertest';
import app from '../../src/app.js';
import User from '../../src/models/user.model.js';

describe('POST /users', () => {
  beforeEach(async () => {
    await User.deleteMany({}); // Clean database
  });

  it('should create user and return 201', async () => {
    const response = await request(app)
      .post('/users')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123',
        firstName: 'John',
        lastName: 'Doe',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe('test@example.com');

    // Verify user in database
    const user = await User.findOne({ email: 'test@example.com' });
    expect(user).toBeTruthy();
    expect(user.firstName).toBe('John');
  });

  it('should return 409 for duplicate email', async () => {
    // Create user first
    await User.create({
      email: 'test@example.com',
      password: 'Pass123',
    });

    // Try to create again
    const response = await request(app)
      .post('/users')
      .send({
        email: 'test@example.com',
        password: 'Pass123',
      })
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.errorCode).toBe('EMAIL_EXISTS');
  });
});
```

### Test Coverage Goals

| Category    | Target | Current |
| ----------- | ------ | ------- |
| Overall     | 80%+   | TBD     |
| Controllers | 90%+   | TBD     |
| Services    | 90%+   | TBD     |
| Models      | 80%+   | TBD     |
| Utilities   | 85%+   | TBD     |

---

## Performance Optimization

### Database Optimization

1. **Indexes**: Create indexes on frequently queried fields

   ```javascript
   userSchema.index({ email: 1 }, { unique: true });
   userSchema.index({ isActive: 1 });
   userSchema.index({ roles: 1 });
   userSchema.index({ createdAt: -1 });
   ```

2. **Field Selection**: Only select needed fields

   ```javascript
   const user = await User.findById(userId).select('email firstName lastName');
   ```

3. **Pagination**: Use skip/limit for large datasets
   ```javascript
   const users = await User.find()
     .skip((page - 1) * pageSize)
     .limit(pageSize)
     .sort({ createdAt: -1 });
   ```

### Caching Strategy (Future)

- **Redis Cache**: Cache frequently accessed user profiles
- **TTL**: 5-10 minutes
- **Invalidation**: On user.updated event
- **Pattern**: Cache-aside (lazy loading)

```javascript
// Future caching example
const user = await cache.get(`user:${userId}`);
if (user) return user;

const userFromDb = await User.findById(userId);
await cache.set(`user:${userId}`, userFromDb, { ttl: 300 });
return userFromDb;
```

### Connection Pooling

Mongoose handles connection pooling automatically:

```javascript
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10, // Maximum connections
  minPoolSize: 2, // Minimum connections
  socketTimeoutMS: 45000,
  family: 4,
});
```

### Response Time Targets

| Endpoint         | p50     | p95     | p99     |
| ---------------- | ------- | ------- | ------- |
| GET /users       | < 50ms  | < 100ms | < 200ms |
| POST /users      | < 100ms | < 200ms | < 300ms |
| PATCH /users     | < 75ms  | < 150ms | < 250ms |
| GET /admin/users | < 200ms | < 400ms | < 600ms |

---

## Deployment

### Environment Variables

```env
# Server
PORT=1002
NODE_ENV=production

# MongoDB
MONGODB_CONNECTION_SCHEME=mongodb+srv
MONGODB_HOST=cluster.mongodb.net
MONGODB_PORT=27017
MONGODB_USERNAME=<encrypted>
MONGODB_PASSWORD=<encrypted>
MONGODB_DB_NAME=user-service-db
MONGODB_DB_PARAMS=retryWrites=true&w=majority

# Dapr
DAPR_HOST=localhost
DAPR_HTTP_PORT=3500
PUBSUB_NAME=user-pubsub
TOPIC_NAME=user.events

# Logging
LOG_LEVEL=info
LOG_TO_CONSOLE=true
LOG_TO_FILE=false

# Feature Flags
FEATURE_WISHLIST_ENABLED=true
FEATURE_PREFERENCES_ENABLED=true
```

### Docker Configuration

**Dockerfile.api:**

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port
EXPOSE 1002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:1002/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

# Start application
CMD ["node", "src/server.js"]
```

### Kubernetes Deployment (Planned)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
        - name: user-service
          image: xshopai/user-service:1.0.0
          ports:
            - containerPort: 1002
          env:
            - name: NODE_ENV
              value: 'production'
            - name: MONGODB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mongodb-secret
                  key: password
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          livenessProbe:
            httpGet:
              path: /health/live
              port: 1002
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 1002
            initialDelaySeconds: 10
            periodSeconds: 5
```

---

## Monitoring & Observability

### Winston Logger Configuration

```javascript
// src/observability/index.js
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

export default logger;
```

### Structured Logging Example

```javascript
logger.info('User created', null, {
  operation: 'create_user',
  userId: user._id.toString(),
  email: user.email,
  correlationId: req.correlationId,
});
```

### Health Check Endpoints

```javascript
// GET /health
{
  status: 'healthy',
  timestamp: '2025-11-04T10:30:00Z',
  service: 'user-service',
  version: '1.0.0',
  dependencies: {
    mongodb: 'connected',
    dapr: 'available'
  }
}
```

---

## Summary

User Service follows a **layered architecture** with clear separation of concerns:

1. **API Layer**: Routes, controllers, middleware
2. **Business Logic Layer**: Services, orchestration
3. **Data Access Layer**: Models, schemas, database operations
4. **Cross-Cutting**: Logging, error handling, utilities

**Key Design Decisions:**

- ✅ **Controller-Service-Model Pattern**: Clear separation of concerns
- ✅ **Pure Publisher**: No event consumption (simplified architecture)
- ✅ **Mongoose ODM**: Schema validation, middleware hooks
- ✅ **Dapr Pub/Sub**: Event bus abstraction, no direct RabbitMQ/Kafka dependency
- ✅ **JWT Validation**: Lightweight authentication (no auth-service calls)
- ✅ **Graceful Degradation**: Continue on event publishing failure
- ✅ **Structured Logging**: Correlation ID in all logs
- ✅ **Stateless Design**: Horizontal scalability

**Next Steps:**

- Implement Redis caching for user profiles
- Add Prometheus metrics export
- Implement OpenTelemetry distributed tracing
- Add GraphQL API support
- Multi-region deployment

---

**Document Version:** 1.0  
**Last Updated:** November 4, 2025  
**Status:** Active Development
