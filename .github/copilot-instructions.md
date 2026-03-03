# Copilot Instructions — user-service

## Service Identity

- **Name**: user-service
- **Purpose**: User profile management — profiles, addresses, payment methods, wishlists, preferences
- **Port**: 8002
- **Language**: Node.js 20+ (JavaScript ESM)
- **Framework**: Express 5.1+
- **Database**: MongoDB 8.0+ (port 27018) via Mongoose ODM
- **Dapr App ID**: `user-service`

## Architecture

- **Pattern**: Layered MVC — routes → controllers → services → models (Mongoose)
- **API Style**: RESTful JSON APIs
- **Authentication**: JWT Bearer tokens validated via middleware
- **Messaging**: Dapr pub/sub (RabbitMQ backend) for user lifecycle events
- **Event Format**: CloudEvents 1.0 specification

## Project Structure

```
user-service/
├── src/
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── models/          # Mongoose schemas/models
│   ├── schemas/         # Reusable subdocuments
│   ├── events/          # Dapr pub/sub event publishing
│   ├── middlewares/      # Auth, logging, tracing, correlation ID
│   ├── validators/      # Input validation (Joi/express-validator)
│   ├── routes/          # Route definitions
│   ├── core/            # Config, logger, errors
│   └── database/        # MongoDB connection setup
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .dapr/components/
└── package.json
```

## Code Conventions

- **ESM modules** (`import/export`), not CommonJS
- Use **Express 5.1+** with async error handling (no need for try-catch wrappers)
- **Mongoose** for all MongoDB interactions — define schemas with validation
- Structured logging via **Winston** with JSON format
- Error handling: custom `ErrorResponse` class extending `Error`
- Correlation IDs propagated via `X-Correlation-ID` header
- Use `const` by default, `let` only when reassignment needed
- Prefer arrow functions for callbacks
- Use `async/await` over `.then()` chains

## Database Patterns

- MongoDB via Mongoose ODM
- Schemas defined in `src/models/` with built-in validation
- Subdocument schemas (addresses, payment methods) in `src/schemas/`
- Indexes defined in schema definitions
- Use `lean()` for read-only queries (performance)
- Timestamps enabled (`createdAt`, `updatedAt`)

## Testing Requirements

- All new controllers MUST have unit tests
- All new services MUST have unit tests
- All new routes MUST have integration or e2e tests
- Use **Jest** as the test framework
- Mock MongoDB with `mongodb-memory-server` or jest mocks in unit tests
- Mock Dapr calls in unit and integration tests via `jest.mock()`
- Do NOT call real downstream services in unit tests
- Test valid inputs, invalid inputs, unauthorized access, and not-found cases
- Run: `npm test` (all), `npm run test:unit`, `npm run test:integration`
- Coverage: `npm run test:coverage`

## Dapr Integration

- **Pub/Sub**: Publishes `user.created`, `user.updated`, `user.deleted` events
- **Config**: `.dapr/components/` for pub/sub (RabbitMQ), state store
- **Ports**: Dapr HTTP 3500, Dapr gRPC 50001

## Security Rules

- JWT MUST be validated before accessing any controller logic
- Ownership checks MUST be enforced — users may only access or modify their own profile
- Admin endpoints MUST require `role === 'admin'`
- Validate all request bodies using validators before reaching services
- Sanitize all inputs
- Rate limiting middleware must be applied to all routes
- Never trust client-provided user IDs — derive identity from the validated JWT

## Error Handling Contract

All errors MUST follow this JSON structure:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable message",
    "correlationId": "uuid"
  }
}
```

- Never expose stack traces in production
- Use centralized error middleware only

## Logging Rules

- Use structured JSON logging only
- Include:
  - timestamp
  - level
  - serviceName
  - correlationId
  - message
- Never log JWT tokens
- Never log secrets

## Non-Goals

- This service is NOT responsible for authentication or issuing JWTs — handled by auth-service
- This service does NOT perform admin operations — handled by admin-service
- This service does NOT manage product catalog, orders, or payments
- This service does NOT consume domain events from other services

## Environment Variables

```
PORT=8002
NODE_ENV=development
MONGODB_URL=mongodb://admin:admin123@localhost:27018/user-service?authSource=admin
JWT_SECRET=<shared-secret>
DAPR_HTTP_PORT=3500
```

## Common Commands

```bash
npm run dev              # Dev with hot reload
npm run dev:dapr         # Dev with Dapr sidecar
npm test                 # All tests
npm run test:coverage    # Coverage report
npm run lint             # ESLint
```
