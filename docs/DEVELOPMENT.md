# Developer Guide

This guide covers local development setup, debugging, and common workflows for the user-service.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running Locally](#running-locally)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Debugging](#debugging)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Node.js**: v20 or higher ([Download](https://nodejs.org/))
- **MongoDB**: v8 or higher ([Download](https://www.mongodb.com/try/download/community))
- **Dapr CLI**: v1.16.2+ ([Install Guide](https://docs.dapr.io/getting-started/install-dapr-cli/))
- **Docker**: For running infrastructure ([Download](https://www.docker.com/get-started))

### Optional Tools

- **Postman** or **Insomnia**: API testing
- **MongoDB Compass**: Database GUI
- **VS Code**: Recommended IDE with extensions:
  - ESLint
  - Prettier
  - REST Client
  - Dapr

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/xshopai/user-service.git
cd user-service
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment

```bash
# Copy environment example
cp .env.example .env

# Edit .env with your local configuration
```

### 4. Start Infrastructure

```bash
# Start MongoDB
docker run -d --name user-mongodb -p 27018:27017 mongo:8

# Or use docker-compose (if available in workspace)
cd ../../scripts
docker-compose -f docker-compose.infrastructure.yml up -d
```

### 5. Configure Dapr Secrets

Create `.dapr/secrets.json`:

```json
{
  "MONGODB_CONNECTION_STRING": "mongodb://localhost:27018/user_service_db",
  "JWT_SECRET": "your-dev-jwt-secret-key"
}
```

## Running Locally

### Option 1: With Dapr (Recommended)

```bash
# Development mode with auto-reload
npm run dev

# Or use platform-specific scripts
./run.sh       # Linux/Mac
.\run.ps1      # Windows
```

This starts:
- User service on port **1002**
- Dapr sidecar on port **3502**
- Auto-reload with nodemon

### Option 2: Standalone (Without Dapr)

```bash
# Production mode
npm start

# Or directly
node src/server.js
```

**Note**: Some features like pub/sub and service invocation won't work without Dapr.

### Option 3: Debug Mode

```bash
# VS Code: Press F5 or use Debug panel
# Or manually:
node --inspect src/server.js
```

## Project Structure

```
user-service/
├── .dapr/                  # Dapr configuration
│   ├── components/        # Dapr component definitions
│   └── config.yaml        # Dapr runtime config
├── .github/               # CI/CD workflows
│   └── workflows/
├── docs/                  # Documentation
├── infra/                 # Infrastructure as Code
│   └── bicep/            # Azure Bicep templates
├── src/
│   ├── controllers/      # HTTP request handlers
│   │   ├── user.controller.js
│   │   └── operational.controller.js
│   ├── database/         # Database connection
│   │   └── database.js
│   ├── middlewares/      # Express middleware
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   └── validation.middleware.js
│   ├── models/           # Mongoose models
│   │   └── user.model.js
│   ├── routes/           # API routes
│   │   ├── user.routes.js
│   │   └── operational.routes.js
│   ├── services/         # Business logic
│   │   ├── user.service.js
│   │   └── dapr.client.js
│   ├── utils/            # Helper functions
│   ├── app.js           # Express app setup
│   └── server.js        # Entry point
├── tests/               # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .env.example        # Environment template
├── package.json
└── README.md
```

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Follow the coding standards (ESLint + Prettier)
- Write tests for new features
- Update documentation

### 3. Run Tests

```bash
npm test                  # All tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:coverage     # With coverage
```

### 4. Lint & Format

```bash
npm run lint             # Check for issues
npm run lint:fix         # Auto-fix issues
```

### 5. Commit Changes

```bash
git add .
git commit -m "feat: add amazing feature"
```

Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `test:` Tests
- `refactor:` Code refactoring

### 6. Push & Create PR

```bash
git push origin feature/your-feature-name
```

Open Pull Request on GitHub.

## Debugging

### VS Code Debug Configuration

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug User Service",
      "skipFiles": ["<node_internals>/**"],
      "program": "${workspaceFolder}/src/server.js",
      "env": {
        "NODE_ENV": "development",
        "PORT": "1002"
      }
    }
  ]
}
```

### Debug with Dapr

```bash
# Start Dapr with debug mode
dapr run --app-id user-service --app-port 1002 --dapr-http-port 3502 \
  --log-level debug -- node --inspect src/server.js
```

Then attach debugger to port 9229.

### Logging

Set log level in `.env`:

```bash
LOG_LEVEL=debug  # Options: error, warn, info, debug
```

View logs:
```bash
# Service logs
tail -f logs/user-service.log

# Dapr logs
dapr logs --app-id user-service
```

## Common Tasks

### Seed Database

```bash
npm run seed
```

### Clear Database

```bash
npm run clear
```

### Generate API Documentation

```bash
npm run docs:generate
```

### Run Specific Test

```bash
npm test -- tests/unit/user.service.test.js
```

### Check Database Connection

```bash
# Using MongoDB Compass
mongodb://localhost:27018

# Or CLI
mongosh mongodb://localhost:27018/user_service_db
```

### Test API Endpoints

```bash
# Health check
curl http://localhost:1002/health

# Create user
curl -X POST http://localhost:1002/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","firstName":"Test","lastName":"User"}'

# Via Dapr
curl http://localhost:3502/v1.0/invoke/user-service/method/api/health
```

## Troubleshooting

### Service Won't Start

**Problem**: Port already in use

```bash
# Find process using port 1002
lsof -i :1002        # Linux/Mac
netstat -ano | findstr :1002  # Windows

# Kill process
kill -9 <PID>        # Linux/Mac
taskkill /PID <PID> /F  # Windows
```

### MongoDB Connection Failed

**Problem**: Cannot connect to MongoDB

```bash
# Check if MongoDB is running
docker ps | grep mongo

# Restart MongoDB
docker restart user-mongodb

# Check connection string in .dapr/secrets.json
```

### Dapr Not Working

**Problem**: Dapr sidecar not starting

```bash
# Check Dapr installation
dapr --version

# Reinitialize Dapr
dapr uninstall
dapr init

# Check components
dapr components -k
```

### Tests Failing

**Problem**: Tests fail locally

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check test environment
NODE_ENV=test npm test
```

### Import Errors

**Problem**: Module not found

```bash
# Clear Jest cache
npm test -- --clearCache

# Verify package.json "type": "module"
```

## Next Steps

- [API Reference](API.md) - Learn about all endpoints
- [Testing Guide](TESTING.md) - Write comprehensive tests
- [Deployment Guide](DEPLOYMENT.md) - Deploy to Azure
- [Architecture](ARCHITECTURE.md) - Understand the design

## Support

- **Questions**: Open a [GitHub Discussion](https://github.com/xshopai/user-service/discussions)
- **Issues**: Report on [GitHub Issues](https://github.com/xshopai/user-service/issues)
