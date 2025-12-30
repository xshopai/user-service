# Configuration Guide

Complete configuration reference for the User Service.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Dapr Configuration](#dapr-configuration)
- [Database Configuration](#database-configuration)
- [Security Configuration](#security-configuration)
- [Logging Configuration](#logging-configuration)
- [Service Configuration](#service-configuration)
- [Environment-Specific Configs](#environment-specific-configs)

## Environment Variables

### Core Service Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Environment mode (development, production, test) |
| `PORT` | Yes | `1002` | HTTP server port |
| `SERVICE_NAME` | No | `user-service` | Service identifier for logging |
| `LOG_LEVEL` | No | `info` | Logging level (error, warn, info, debug) |

### Database Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `MONGODB_DB_NAME` | No | `user_service_db` | Database name |
| `MONGODB_MIN_POOL_SIZE` | No | `5` | Min connection pool size |
| `MONGODB_MAX_POOL_SIZE` | No | `10` | Max connection pool size |
| `MONGODB_TIMEOUT` | No | `30000` | Connection timeout (ms) |

### Authentication & Security

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | Secret key for JWT signing |
| `JWT_EXPIRY` | No | `24h` | JWT token expiration |
| `JWT_REFRESH_EXPIRY` | No | `7d` | Refresh token expiration |
| `BCRYPT_ROUNDS` | No | `10` | Password hashing rounds |
| `PASSWORD_MIN_LENGTH` | No | `8` | Minimum password length |

### Dapr Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DAPR_HTTP_PORT` | No | `3502` | Dapr sidecar HTTP port |
| `DAPR_GRPC_PORT` | No | `50002` | Dapr sidecar gRPC port |
| `DAPR_PUBSUB_NAME` | No | `pubsub` | Pub/sub component name |
| `DAPR_STATE_STORE_NAME` | No | `statestore` | State store component name |

### Email Service (via Dapr)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EMAIL_SERVICE_APP_ID` | No | `notification-service` | Email service Dapr app ID |
| `EMAIL_VERIFICATION_TOPIC` | No | `email.verification` | Email verification topic |
| `PASSWORD_RESET_TOPIC` | No | `email.password-reset` | Password reset topic |

### CORS Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CORS_ORIGINS` | No | `http://localhost:3000` | Allowed CORS origins (comma-separated) |
| `CORS_CREDENTIALS` | No | `true` | Allow credentials in CORS |

### Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_WINDOW` | No | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Max requests per window |
| `RATE_LIMIT_SKIP_SUCCESS` | No | `false` | Only count failed requests |

### Health Check Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HEALTH_CHECK_TIMEOUT` | No | `5000` | Health check timeout (ms) |
| `READINESS_CHECK_INTERVAL` | No | `30000` | Readiness check interval (ms) |

## Dapr Configuration

### Dapr Runtime Config

Location: `.dapr/config.yaml`

```yaml
apiVersion: dapr.io/v1alpha1
kind: Configuration
metadata:
  name: appconfig
spec:
  # Tracing configuration
  tracing:
    samplingRate: "1"
    zipkin:
      endpointAddress: "http://localhost:9411/api/v2/spans"
  
  # Metrics configuration
  metrics:
    enabled: true
  
  # Access control
  accessControl:
    defaultAction: allow
    trustDomain: "public"
```

### Pub/Sub Component

Location: `.dapr/components/pubsub.yaml`

```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: pubsub
spec:
  type: pubsub.redis
  version: v1
  metadata:
  - name: redisHost
    value: localhost:6379
  - name: redisPassword
    value: ""
  - name: enableTLS
    value: "false"
```

### State Store Component

Location: `.dapr/components/statestore.yaml`

```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: statestore
spec:
  type: state.mongodb
  version: v1
  metadata:
  - name: host
    value: localhost:27018
  - name: databaseName
    value: user_service_state
  - name: collectionName
    value: state
```

### Secrets Store Component

Location: `.dapr/components/secrets.yaml`

```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: secrets
spec:
  type: secretstores.local.file
  version: v1
  metadata:
  - name: secretsFile
    value: ./.dapr/secrets.json
```

**Secrets File** (`.dapr/secrets.json`):

```json
{
  "MONGODB_CONNECTION_STRING": "mongodb://localhost:27018/user_service_db",
  "JWT_SECRET": "your-dev-jwt-secret-key-change-in-production",
  "JWT_REFRESH_SECRET": "your-dev-jwt-refresh-secret-change-in-production"
}
```

**⚠️ Security Warning**: Never commit secrets.json to version control. Use Azure Key Vault in production.

## Database Configuration

### MongoDB Connection

#### Local Development

```bash
# .env
MONGODB_URI=mongodb://localhost:27018/user_service_db
```

#### Production (Azure Cosmos DB)

```bash
# .env
MONGODB_URI=mongodb://cosmos-xshopai.mongo.cosmos.azure.com:10255/?ssl=true&retrywrites=false&maxIdleTimeMS=120000&appName=@cosmos-xshopai@
```

### Connection Options

```javascript
// src/database/database.js
const options = {
  minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE) || 5,
  maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE) || 10,
  serverSelectionTimeoutMS: parseInt(process.env.MONGODB_TIMEOUT) || 30000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4
  retryWrites: true,
  retryReads: true,
  w: 'majority',
  readPreference: 'primaryPreferred',
  connectTimeoutMS: 10000,
  heartbeatFrequencyMS: 10000
};

await mongoose.connect(process.env.MONGODB_URI, options);
```

### Database Indexes

```javascript
// src/models/user.model.js
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ isActive: 1, deletedAt: 1 });
UserSchema.index({ 'address.city': 1, 'address.state': 1 });
```

## Security Configuration

### JWT Configuration

```javascript
// src/config/jwt.config.js
export const jwtConfig = {
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  expiresIn: process.env.JWT_EXPIRY || '24h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
  issuer: 'user-service',
  audience: 'xshopai',
  algorithm: 'HS256'
};
```

### Password Policy

```javascript
// src/config/password.config.js
export const passwordConfig = {
  minLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
  preventReuse: 5, // Last 5 passwords
  expiryDays: 90 // Password expires after 90 days
};
```

### CORS Configuration

```javascript
// src/config/cors.config.js
export const corsConfig = {
  origin: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  exposedHeaders: ['X-Correlation-ID', 'X-RateLimit-Remaining'],
  maxAge: 86400 // 24 hours
};
```

## Logging Configuration

### Winston Configuration

```javascript
// src/config/logger.config.js
import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const serviceName = process.env.SERVICE_NAME || 'user-service';

export const loggerConfig = {
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: {
    service: serviceName,
    version: process.env.npm_package_version
  },
  transports: [
    // Console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      )
    }),
    
    // File - Error logs
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    // File - Combined logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ]
};
```

### Log Rotation

```bash
# Using logrotate (Linux)
# /etc/logrotate.d/user-service

/path/to/user-service/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 nodejs nodejs
    sharedscripts
    postrotate
        systemctl reload user-service
    endscript
}
```

## Service Configuration

### Express Server Configuration

```javascript
// src/config/server.config.js
export const serverConfig = {
  port: parseInt(process.env.PORT) || 1002,
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',
  trustProxy: true,
  
  // Body parser limits
  jsonLimit: '10mb',
  urlEncodedLimit: '10mb',
  
  // Request timeout
  timeout: 30000, // 30 seconds
  
  // Keep-alive
  keepAliveTimeout: 65000
};
```

### Rate Limiting Configuration

```javascript
// src/config/rateLimit.config.js
export const rateLimitConfig = {
  // General API rate limit
  general: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
  },
  
  // Authentication endpoints (stricter)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    skipSuccessfulRequests: true,
    message: 'Too many authentication attempts'
  },
  
  // Email verification (prevent abuse)
  email: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: 'Too many verification emails sent'
  }
};
```

## Environment-Specific Configs

### Development Environment

```bash
# .env.development
NODE_ENV=development
PORT=1002
LOG_LEVEL=debug

# Database
MONGODB_URI=mongodb://localhost:27018/user_service_db

# Security (use weak secrets in dev)
JWT_SECRET=dev-secret-key-not-for-production
JWT_EXPIRY=24h
BCRYPT_ROUNDS=4

# CORS (allow all in dev)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate limiting (relaxed in dev)
RATE_LIMIT_MAX_REQUESTS=1000

# Dapr
DAPR_HTTP_PORT=3502
DAPR_GRPC_PORT=50002
```

### Production Environment

```bash
# .env.production (via Azure App Settings or Key Vault)
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

# Database (Cosmos DB)
MONGODB_URI=${COSMOS_DB_CONNECTION_STRING}

# Security (strong secrets from Key Vault)
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=1h
JWT_REFRESH_EXPIRY=7d
BCRYPT_ROUNDS=12

# CORS (specific origins only)
CORS_ORIGINS=https://xshop.ai,https://admin.xshop.ai

# Rate limiting (strict in production)
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW=60000

# Azure-specific
APPLICATIONINSIGHTS_CONNECTION_STRING=${APP_INSIGHTS_CONNECTION_STRING}

# Dapr (Azure App Service)
DAPR_HTTP_PORT=3500
DAPR_GRPC_PORT=50001
```

### Test Environment

```bash
# .env.test
NODE_ENV=test
PORT=0  # Random port
LOG_LEVEL=error

# Test database
MONGODB_URI=mongodb://localhost:27019/user_service_test

# Test secrets
JWT_SECRET=test-secret-key
JWT_EXPIRY=1h
BCRYPT_ROUNDS=4

# Disable rate limiting in tests
RATE_LIMIT_MAX_REQUESTS=10000
```

## Configuration Validation

### Environment Validation

```javascript
// src/config/validate.js
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().int().positive(),
  MONGODB_URI: z.string().url(),
  JWT_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  CORS_ORIGINS: z.string().optional(),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().optional()
});

export function validateConfig() {
  try {
    envSchema.parse(process.env);
    console.log('✅ Configuration validated successfully');
  } catch (error) {
    console.error('❌ Configuration validation failed:', error.errors);
    process.exit(1);
  }
}
```

### Usage

```javascript
// src/server.js
import { validateConfig } from './config/validate.js';

// Validate configuration on startup
validateConfig();

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## Configuration Management Best Practices

### ✅ DO

- **Use environment variables** for configuration
- **Validate configuration** on startup
- **Use strong secrets** in production
- **Rotate secrets** regularly
- **Document all variables** in .env.example
- **Use Azure Key Vault** for production secrets
- **Set appropriate defaults** for optional variables

### ❌ DON'T

- **Commit secrets** to version control
- **Use weak secrets** in production
- **Hard-code configuration** values
- **Share secrets** across environments
- **Use production secrets** in development
- **Expose secrets** in logs or errors
- **Skip configuration validation**

## Troubleshooting Configuration

### Missing Environment Variables

```bash
# Check loaded environment variables
node -e "console.log(process.env)" | grep MONGODB

# Verify .env file is loaded
node -e "require('dotenv').config(); console.log(process.env.MONGODB_URI)"
```

### Invalid Configuration

```bash
# Run configuration validation
npm run validate-config

# Check for typos in variable names
grep -r "process.env" src/ | sort | uniq
```

### Dapr Configuration Issues

```bash
# Verify Dapr components
dapr components -k

# Check Dapr configuration
cat .dapr/config.yaml

# Test Dapr connection
curl http://localhost:3502/v1.0/healthz
```

## Next Steps

- [Development Guide](DEVELOPMENT.md) - Set up local environment
- [Security Guide](SECURITY.md) - Configure security settings
- [Deployment Guide](DEPLOYMENT.md) - Configure for deployment
- [Monitoring Guide](MONITORING.md) - Set up logging and metrics