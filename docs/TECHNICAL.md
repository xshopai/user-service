# Technical Reference

> **Deep-dive technical documentation** for User Service architecture, security practices, and observability.  
> **Audience**: Senior developers, DevOps engineers, security auditors  
> **Version**: 1.0  
> **Last Updated**: December 2024

## Table of Contents

- [Architecture](#architecture)
  - [Overview](#overview)
  - [Technology Stack](#technology-stack)
  - [Architecture Layers](#architecture-layers)
  - [Design Patterns](#design-patterns)
  - [Event-Driven Architecture](#event-driven-architecture)
  - [Performance Optimization](#performance-optimization)
- [Security](#security)
  - [Authentication](#authentication)
  - [Authorization](#authorization)
  - [Data Protection](#data-protection)
  - [API Security](#api-security)
  - [Security Best Practices](#security-best-practices)
  - [Compliance](#compliance)
- [Observability](#observability)
  - [Logging](#logging)
  - [Metrics](#metrics)
  - [Distributed Tracing](#distributed-tracing)
  - [Health Checks](#health-checks)
  - [Alerts](#alerts)
  - [Performance Monitoring](#performance-monitoring)

---

# Architecture

## Overview

User Service is the **foundational identity and profile management service** in the xshop.ai platform. It follows a **layered architecture** pattern with clear separation of concerns and implements **event-driven integration** using Dapr Pub/Sub for asynchronous communication.

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

- **Node.js**: v20+ LTS
- **JavaScript**: ES6+ modules
- **npm**: Package management

### Web Framework

- **Express**: v5.1.0 (async routes support)
- **cors**: Cross-origin resource sharing
- **helmet**: Security headers
- **express-rate-limit**: Rate limiting middleware

### Database

- **MongoDB**: v8.18.0 (document database)
- **Mongoose**: v8.8.4 (ODM with schema validation)
- **Connection**: MongoDB Atlas or local MongoDB
- **Pooling**: Connection pooling built into Mongoose

### Event System

- **Dapr SDK for Node.js**: Event pub/sub abstraction
- **@dapr/dapr**: Official Dapr SDK
- **RabbitMQ**: Message broker (behind Dapr)
- **Topics**: `user.events`

### Security

- **bcryptjs**: Password hashing (cost factor: 12)
- **jsonwebtoken**: JWT parsing
- **helmet**: Security headers
- **express-rate-limit**: DDoS protection

### Logging & Monitoring

- **Winston**: Structured JSON logging
- **winston-daily-rotate-file**: Log rotation
- **Correlation ID Middleware**: Request tracing

### Testing

- **Jest**: Unit and integration testing
- **Supertest**: HTTP API testing
- **mongodb-memory-server**: In-memory MongoDB for tests

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
- **Event Publisher**: Publish domain events via Dapr SDK

---

## Design Patterns

### 1. Controller-Service-Model Pattern

**Controllers** handle HTTP concerns, **Services** contain business logic, **Models** handle data access.

```javascript
// Controller (user.controller.js)
export const createUser = asyncHandler(async (req, res, next) => {
  const { email, password, firstName, lastName } = req.body;
  
  const user = await userService.createUser(
    { email, password, firstName, lastName },
    req.correlationId,
    req.ip,
    req.get('user-agent')
  );

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: { userId: user._id, email: user.email }
  });
});

// Service (user.service.js)
export async function createUser(userData, correlationId, ipAddress, userAgent) {
  const user = await User.create(userData);
  await daprPublisher.publishUserCreated(user, correlationId, ipAddress, userAgent);
  return user;
}
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
router.get('/profile', 
  requireAuth,                 // JWT validation
  requireRole(['customer']),   // RBAC
  getProfile                   // Controller
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

### Event Types Published

| Event Type | Trigger | Data | Consumers |
|-----------|---------|------|-----------|
| `user.created` | User registration | userId, email, firstName, lastName | notification, audit, auth |
| `user.updated` | Profile update | userId, updatedBy, changes | audit, auth (cache invalidation) |
| `user.deleted` | Account deletion | userId, email | audit, notification, auth, order, review |
| `user.deactivated` | Account deactivation | userId, reason | auth (revoke tokens), audit |
| `user.reactivated` | Account reactivation | userId | auth, audit |

### Event Format

```javascript
{
  source: 'user-service',
  eventType: 'user.created',
  eventVersion: '1.0',
  eventId: 'evt-123-xyz',
  timestamp: '2025-11-04T10:30:00Z',
  correlationId: 'corr-abc-def',
  data: {
    userId: '507f1f77bcf86cd799439011',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe'
  },
  metadata: {
    environment: 'production',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...'
  }
}
```

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
   const user = await User.findById(userId)
     .select('email firstName lastName');
   ```

3. **Pagination**: Use skip/limit for large datasets
   ```javascript
   const users = await User.find()
     .skip((page - 1) * pageSize)
     .limit(pageSize)
     .sort({ createdAt: -1 });
   ```

### Connection Pooling

Mongoose handles connection pooling automatically:

```javascript
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10,      // Maximum connections
  minPoolSize: 2,       // Minimum connections
  socketTimeoutMS: 45000,
  family: 4
});
```

### Response Time Targets

| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| GET /users | < 50ms | < 100ms | < 200ms |
| POST /users | < 100ms | < 200ms | < 300ms |
| PATCH /users | < 75ms | < 150ms | < 250ms |
| GET /admin/users | < 200ms | < 400ms | < 600ms |

---

# Security

## Authentication

### JWT Token Structure

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "role": "customer",
    "iat": 1699999999,
    "exp": 1700086399
  },
  "signature": "..."
}
```

### Authentication Middleware

```javascript
export const requireAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new ErrorResponse('Authentication required', 401, 'UNAUTHORIZED'));
  }

  try {
    const decoded = jwt.decode(token);
    
    if (!decoded) {
      return next(new ErrorResponse('Invalid token', 401, 'INVALID_TOKEN'));
    }

    req.user = {
      userId: decoded.userId || decoded.sub,
      email: decoded.email,
      roles: decoded.roles || []
    };

    next();
  } catch (error) {
    return next(new ErrorResponse('Token validation failed', 401, 'INVALID_TOKEN'));
  }
});
```

### Password Security

#### Password Requirements

- Minimum length: 8 characters
- Must contain:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character (@$!%*?&)

#### Password Hashing

```javascript
import bcrypt from 'bcryptjs';

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.password = await bcrypt.hash(this.password, rounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};
```

---

## Authorization

### Role-Based Access Control (RBAC)

#### Roles

- **customer**: Regular user
- **admin**: Administrator with elevated privileges

#### Permission Matrix

| Endpoint | Customer | Admin |
|----------|----------|-------|
| GET /api/users/:id (own) | ✅ | ✅ |
| GET /api/users/:id (any) | ❌ | ✅ |
| GET /api/users (list) | ❌ | ✅ |
| POST /api/users | ✅ | ✅ |
| PUT /api/users/:id (own) | ✅ | ✅ |
| PUT /api/users/:id (any) | ❌ | ✅ |
| DELETE /api/users/:id | ❌ | ✅ |

### Authorization Middleware

```javascript
export const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ErrorResponse('Authentication required', 401, 'UNAUTHORIZED'));
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return next(new ErrorResponse('Insufficient permissions', 403, 'FORBIDDEN'));
    }

    next();
  };
};
```

---

## Data Protection

### Data Encryption

#### At Rest

- **Database**: MongoDB encryption at rest
- **Backups**: Encrypted with AES-256
- **Secrets**: Stored in Azure Key Vault or Dapr Secret Store

#### In Transit

- **HTTPS**: TLS 1.2+ for all external communication
- **Inter-service**: mTLS via Dapr (in production)

### Sensitive Data Handling

#### Personal Identifiable Information (PII)

```javascript
// Never log sensitive data
logger.info('User created', {
  userId: user._id,
  // ❌ DON'T: email: user.email
  // ❌ DON'T: password: user.password
});

// Mask sensitive fields in responses
UserSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};
```

### Data Retention

```javascript
// Soft delete with retention period
UserSchema.add({
  deletedAt: Date,
  scheduledPurgeDate: Date
});

// Schedule purge after 90 days
async function softDeleteUser(userId) {
  const purgeDate = new Date();
  purgeDate.setDate(purgeDate.getDate() + 90);

  await User.findByIdAndUpdate(userId, {
    isActive: false,
    deletedAt: new Date(),
    scheduledPurgeDate: purgeDate
  });
}
```

---

## API Security

### Input Validation

```javascript
import { body, validationResult } from 'express-validator';

export const validateCreateUser = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain uppercase, lowercase, number, and special character'),
  
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be 2-50 characters')
    .escape()
];
```

### Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

// General rate limit
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  max: 100,               // 100 requests per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    }
  }
});

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 attempts per 15 minutes
  skipSuccessfulRequests: true
});

app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);
```

### Security Headers

```javascript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: true,
  dnsPrefetchControl: true,
  frameguard: true,
  hidePoweredBy: true,
  hsts: true,
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: true,
  referrerPolicy: true,
  xssFilter: true
}));
```

---

## Security Best Practices

### Environment Variables

```bash
# ❌ DON'T: Commit secrets to repository
JWT_SECRET=mysecretkey123

# ✅ DO: Use environment-specific secrets
JWT_SECRET=${JWT_SECRET}  # From environment or secret manager

# ✅ DO: Use .env.example as template
cp .env.example .env
```

### Dependency Management

```bash
# Regularly audit dependencies
npm audit

# Fix vulnerabilities
npm audit fix

# Check for outdated packages
npm outdated
```

### Error Handling

```javascript
// ✅ DO: Return generic error messages
app.use((err, req, res, next) => {
  logger.error('Internal server error', {
    error: err.message,
    stack: err.stack,
    correlationId: req.correlationId
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      correlationId: req.correlationId
    }
  });
});
```

---

## Compliance

### GDPR Compliance

#### Data Subject Rights

1. **Right to Access**: Users can request their data
2. **Right to Rectification**: Users can update their data
3. **Right to Erasure**: Users can delete their data
4. **Right to Data Portability**: Export user data

**Implementation**:

```javascript
// Export user data
export async function exportUserData(userId) {
  const user = await User.findById(userId).lean();
  const orders = await Order.find({ userId }).lean();
  const reviews = await Review.find({ userId }).lean();

  return {
    user,
    orders,
    reviews,
    exportedAt: new Date().toISOString()
  };
}

// Delete user data (GDPR Right to Erasure)
export async function deleteUserData(userId) {
  await User.findByIdAndUpdate(userId, {
    isActive: false,
    deletedAt: new Date(),
    email: `deleted_${userId}@deleted.com`,
    firstName: 'Deleted',
    lastName: 'User'
  });

  await Order.updateMany(
    { userId },
    { $set: { userId: null, customerName: 'Deleted User' } }
  );
}
```

---

# Observability

## Logging

### Log Levels

```javascript
// Log levels (lowest to highest priority)
DEBUG → INFO → WARN → ERROR
```

**Usage**:
- `DEBUG`: Detailed debugging information
- `INFO`: General informational messages
- `WARN`: Warning messages (degraded functionality)
- `ERROR`: Error messages (functionality broken)

### Structured JSON Logging

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "service": "user-service",
  "correlationId": "abc123-def456",
  "userId": "507f1f77bcf86cd799439011",
  "message": "User created successfully",
  "context": {
    "method": "POST",
    "path": "/api/users",
    "statusCode": 201,
    "duration": 245
  }
}
```

### Logging Implementation

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'user-service'
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export default logger;
```

### Usage Examples

```javascript
// Info logging
logger.info('User created', {
  userId: user.id,
  email: user.email,
  correlationId: req.correlationId
});

// Error logging
logger.error('Database connection failed', {
  error: err.message,
  stack: err.stack,
  correlationId: req.correlationId
});
```

### Correlation IDs

Every request is assigned a correlation ID for tracing:

```javascript
import { v4 as uuidv4 } from 'uuid';

export const correlationMiddleware = (req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('X-Correlation-ID', req.correlationId);
  
  logger.info('Request received', {
    correlationId: req.correlationId,
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  
  next();
};
```

---

## Metrics

### Key Metrics

#### Request Metrics
- **Request Rate**: Requests per second
- **Response Time**: p50, p95, p99 latencies
- **Error Rate**: 4xx and 5xx error percentages
- **Status Code Distribution**: 200, 400, 401, 404, 500

#### Application Metrics
- **User Operations**: Registrations, logins, updates per minute
- **Database Operations**: Query time, connection pool usage

#### System Metrics
- **CPU Usage**: Percentage
- **Memory Usage**: Heap size, RSS
- **Event Loop Lag**: Node.js event loop delay

### Metrics Implementation

```javascript
import prometheus from 'prom-client';

// Create metrics registry
const register = new prometheus.Registry();

// Default metrics (CPU, memory, etc.)
prometheus.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});
register.registerMetric(httpRequestDuration);

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## Distributed Tracing

### Dapr Tracing

Dapr provides automatic distributed tracing with Zipkin.

#### Configuration

`.dapr/config.yaml`:

```yaml
apiVersion: dapr.io/v1alpha1
kind: Configuration
metadata:
  name: appconfig
spec:
  tracing:
    samplingRate: "1"  # 100% sampling (use 0.1 for 10% in production)
    zipkin:
      endpointAddress: "http://localhost:9411/api/v2/spans"
```

#### View Traces

Open: `http://localhost:9411`

**What You'll See**:
- Request flow across services
- Service dependencies
- Performance bottlenecks
- Error traces

---

## Health Checks

### Health Endpoints

#### Health Check (`/health`)

Overall service health:

```http
GET /health
```

**Response**:
```json
{
  "status": "UP",
  "service": "user-service",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "dependencies": {
    "database": "UP",
    "dapr": "UP"
  }
}
```

#### Readiness Check (`/ready`)

Service ready to accept traffic:

```http
GET /ready
```

#### Liveness Check (`/live`)

Service is alive (for Kubernetes):

```http
GET /live
```

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /live
    port: 1002
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready
    port: 1002
  initialDelaySeconds: 10
  periodSeconds: 5
  failureThreshold: 3
```

---

## Alerts

### Alert Rules

#### Critical Alerts

1. **Service Down**
   - Condition: Health check fails for 2 minutes
   - Action: Page on-call engineer

2. **High Error Rate**
   - Condition: Error rate > 5% for 5 minutes
   - Action: Send Slack notification

3. **Database Connection Lost**
   - Condition: MongoDB connection down
   - Action: Page on-call engineer

#### Warning Alerts

1. **High Response Time**
   - Condition: p95 latency > 1s for 10 minutes
   - Action: Send Slack notification

2. **High Memory Usage**
   - Condition: Memory > 80% for 15 minutes
   - Action: Send email notification

---

## Performance Monitoring

### Key Performance Indicators

1. **Response Time**
   - Target: p95 < 500ms
   - Measure: Histogram metrics

2. **Throughput**
   - Target: > 1000 req/s
   - Measure: Request counter

3. **Error Rate**
   - Target: < 1%
   - Measure: Error counter / Total requests

4. **Database Query Time**
   - Target: p95 < 100ms
   - Measure: Query duration histogram

### Performance Optimization Tips

1. **Index Database Queries**
   ```javascript
   UserSchema.index({ email: 1 }, { unique: true });
   UserSchema.index({ createdAt: -1 });
   ```

2. **Cache Frequently Accessed Data**
   ```javascript
   const cachedUser = await redisClient.get(`user:${userId}`);
   if (cachedUser) return JSON.parse(cachedUser);
   ```

3. **Use Connection Pooling**
   ```javascript
   mongoose.connect(mongoUri, {
     maxPoolSize: 10,
     minPoolSize: 5
   });
   ```

---

## Related Documentation

- [README](../README.md)
- [DEVELOPER_GUIDE](DEVELOPER_GUIDE.md)
