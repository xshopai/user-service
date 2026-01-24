# Local Development Guide (without Dapr)

This guide covers running the User Service locally without Dapr, using direct mode for simpler development and debugging.

> **📋 Prerequisites**: Complete the [Prerequisites & Common Setup](PREREQUISITES.md) before following this guide.

---

## Overview

This setup uses:

- **Node.js/Express development server** for the application
- **Direct MongoDB connection** for data persistence
- **Event publishing disabled** (logged only)
- Simpler configuration, good for basic development and debugging

For production-like local development with Dapr, see [Local Development with Dapr](LOCAL_DEVELOPMENT_DAPR.md).

---

## Step 1: Configure Environment for Non-Dapr Mode

Ensure your `.env` file includes the required configuration:

```bash
# Application
NODE_ENV=development
PORT=8002
NAME=user-service
VERSION=1.0.0

# Logging
LOG_LEVEL=debug
LOG_FORMAT=console

# MongoDB Connection
MONGODB_HOST=localhost
MONGODB_PORT=27018
MONGODB_USERNAME=admin
MONGODB_PASSWORD=admin123
MONGODB_DATABASE=user_service_db
MONGODB_AUTH_SOURCE=admin

# JWT Configuration (required for authentication)
JWT_SECRET=8tDBDMcpxroHoHjXjk8xp/uAn8rzD4y8ZZremFkC4gI=
JWT_ALGORITHM=HS256
JWT_EXPIRES_IN=24h
```

> **Note**:
>
> - Event publishing is automatically disabled without Dapr sidecar
> - `JWT_SECRET` must match the secret used by auth-service to sign tokens

---

## Step 2: Start the Service

```bash
# Make sure you're in the project directory
cd user-service

# Start the development server with hot reload
npm run dev

# Or for production mode
npm start
```

Expected output:

```
[user-service] info: Server starting...
[user-service] info: Connected to MongoDB
[user-service] info: Server running on http://localhost:8002
```

---

## Step 3: Verify the Service

### Health Check

```bash
# Liveness check
curl http://localhost:8002/health

# Readiness check (verifies database connection)
curl http://localhost:8002/health/ready
```

---

## Step 4: Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/unit/user.controller.test.js

# Run tests in watch mode
npm run test:watch
```

---

## Common Tasks

### View Logs

Logs are output to console in development mode. Set `LOG_LEVEL=debug` in `.env` for verbose logging.

### Database Operations

```bash
# Connect to MongoDB
docker exec -it user-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin

# Inside MongoDB shell
use user_service_db
db.users.find().pretty()
db.users.countDocuments()
```

### Reset Database

```bash
# Drop and recreate (WARNING: destroys all data)
docker exec user-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin --eval "db.getSiblingDB('user_service_db').dropDatabase()"
```

---

## Debugging

### VS Code Debugging

Use the provided launch configuration in `.vscode/launch.json`:

1. Open VS Code
2. Go to Run and Debug (Ctrl+Shift+D)
3. Select "Debug User Service (Direct)"
4. Press F5

### Environment Variables for Debugging

```bash
# Enable verbose logging
LOG_LEVEL=debug

# Enable Node.js debugging
NODE_OPTIONS=--inspect
```

---

## API Testing

### Using curl

```bash
# Health check
curl http://localhost:8002/health

# Get user profile (requires auth token)
curl http://localhost:8002/api/users/profile \
  -H "Authorization: Bearer <token>"

# Update user profile
curl -X PATCH http://localhost:8002/api/users/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"firstName": "John", "lastName": "Doe"}'
```

### Using Postman

Import the Postman collection from `scripts/postman/User.json` for pre-configured requests.

---

## Troubleshooting

### MongoDB Connection Failed

```bash
# Check if MongoDB is running
docker ps | grep mongo

# If not running, start it
docker-compose up -d user-mongodb

# Check MongoDB logs
docker logs user-mongodb
```

### Port Already in Use

```bash
# Find process using port 8002
# On Windows (PowerShell)
Get-NetTCPConnection -LocalPort 8002

# On Linux/Mac
lsof -i :8002

# Kill the process or use a different port
PORT=8003 npm run dev
```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
```

---

## Next Steps

- For production-like local development with Dapr: [Local Development with Dapr](LOCAL_DEVELOPMENT_DAPR.md)
- Review the [Architecture Documentation](ARCHITECTURE.md) for service design details
