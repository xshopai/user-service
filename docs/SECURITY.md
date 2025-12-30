# Security Guide

Comprehensive security documentation for the User Service.

## Table of Contents

- [Authentication](#authentication)
- [Authorization](#authorization)
- [Data Protection](#data-protection)
- [API Security](#api-security)
- [Security Best Practices](#security-best-practices)
- [Compliance](#compliance)
- [Incident Response](#incident-response)

## Authentication

### JWT (JSON Web Tokens)

The User Service uses JWT for authentication.

#### Token Structure

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

#### Token Generation

```javascript
import jwt from 'jsonwebtoken';

export function generateToken(user) {
  const payload = {
    userId: user._id.toString(),
    email: user.email,
    role: user.role
  };

  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRY || '24h',
      issuer: 'user-service',
      audience: 'xshopai'
    }
  );

  return token;
}
```

#### Token Verification

```javascript
export function verifyToken(token) {
  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        issuer: 'user-service',
        audience: 'xshopai'
      }
    );
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}
```

### Authentication Middleware

```javascript
import { verifyToken } from '../utils/jwt.js';

export const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No token provided'
        }
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // Verify token
    const decoded = verifyToken(token);

    // Check if user still exists and is active
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found or inactive'
        }
      });
    }

    // Attach user to request
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: error.message
      }
    });
  }
};
```

### Refresh Tokens

```javascript
export function generateRefreshToken(user) {
  const payload = {
    userId: user._id.toString(),
    type: 'refresh'
  };

  return jwt.sign(
    payload,
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
}

export async function refreshAccessToken(refreshToken) {
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  
  if (decoded.type !== 'refresh') {
    throw new Error('Invalid refresh token');
  }

  const user = await User.findById(decoded.userId);
  if (!user || !user.isActive) {
    throw new Error('User not found or inactive');
  }

  return generateToken(user);
}
```

### Password Security

#### Password Requirements

- Minimum length: 8 characters
- Must contain:
  - At least one uppercase letter
  - At least one lowercase letter
  - At least one number
  - At least one special character (@$!%*?&)

#### Password Validation

```javascript
export function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[@$!%*?&]/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumber) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
```

#### Password Hashing

```javascript
import bcrypt from 'bcrypt';

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 10;
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

## Authorization

### Role-Based Access Control (RBAC)

#### Roles

- **customer**: Regular user
- **admin**: Administrator with elevated privileges
- **support**: Support staff with read access

#### Permission Matrix

| Endpoint | Customer | Admin | Support |
|----------|----------|-------|---------|
| GET /api/users/:id (own) | ✅ | ✅ | ✅ |
| GET /api/users/:id (any) | ❌ | ✅ | ✅ |
| GET /api/users (list) | ❌ | ✅ | ✅ |
| POST /api/users | ✅ | ✅ | ❌ |
| PUT /api/users/:id (own) | ✅ | ✅ | ❌ |
| PUT /api/users/:id (any) | ❌ | ✅ | ❌ |
| DELETE /api/users/:id | ❌ | ✅ | ❌ |
| PATCH /api/users/:id/role | ❌ | ✅ | ❌ |

### Authorization Middleware

```javascript
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    }

    next();
  };
};
```

#### Usage Example

```javascript
import { authMiddleware, authorize } from './middlewares/auth.middleware.js';

// Only authenticated users
router.get('/api/users/:id', authMiddleware, getUserById);

// Only admins
router.get('/api/users', authMiddleware, authorize('admin'), listUsers);

// Admins or support
router.get('/api/users/export', authMiddleware, authorize('admin', 'support'), exportUsers);
```

### Resource-Based Authorization

```javascript
export const authorizeResourceOwner = (req, res, next) => {
  const requestedUserId = req.params.userId;
  const authenticatedUserId = req.user.userId;

  // Allow if user is admin or accessing own resource
  if (req.user.role === 'admin' || requestedUserId === authenticatedUserId) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Cannot access another user\'s resource'
    }
  });
};
```

## Data Protection

### Data Encryption

#### At Rest

- **Database**: MongoDB encryption at rest (Azure Cosmos DB)
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

#### Data Minimization

Only collect and store necessary data:

```javascript
// ✅ GOOD: Only required fields
const user = {
  email: req.body.email,
  firstName: req.body.firstName,
  lastName: req.body.lastName
};

// ❌ BAD: Storing unnecessary data
const user = {
  ...req.body,  // Might include unnecessary fields
  ipAddress: req.ip,  // Only store if required by law
  userAgent: req.headers['user-agent']
};
```

### Data Retention

```javascript
// Soft delete with retention period
UserSchema.add({
  deletedAt: Date,
  scheduledPurgeDat: Date
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

// Automated purge job
async function purgeExpiredUsers() {
  const result = await User.deleteMany({
    scheduledPurgeDate: { $lte: new Date() }
  });
  logger.info('Purged expired users', { count: result.deletedCount });
}
```

## API Security

### Input Validation

```javascript
import { body, param, validationResult } from 'express-validator';

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
    .escape(),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be 2-50 characters')
    .escape(),

  // Validation result handler
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          details: errors.array()
        }
      });
    }
    next();
  }
];
```

### SQL/NoSQL Injection Prevention

```javascript
// ✅ GOOD: Using parameterized queries
const user = await User.findOne({ email: email });

// ✅ GOOD: Validating input
const userId = req.params.userId;
if (!mongoose.Types.ObjectId.isValid(userId)) {
  throw new Error('Invalid user ID');
}

// ❌ BAD: Dynamic query construction
const query = `{ email: "${req.body.email}" }`;  // Never do this
const user = await User.findOne(eval(query));
```

### Cross-Site Scripting (XSS) Prevention

```javascript
import helmet from 'helmet';
import { escape } from 'validator';

// Use Helmet for security headers
app.use(helmet());

// Sanitize user input
const sanitizedName = escape(req.body.firstName);

// Set Content Security Policy
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', 'https:'],
  }
}));
```

### Cross-Site Request Forgery (CSRF) Protection

```javascript
import csrf from 'csurf';

// Enable CSRF protection for state-changing operations
const csrfProtection = csrf({ cookie: true });

router.post('/api/users', csrfProtection, createUser);
router.put('/api/users/:id', csrfProtection, updateUser);
router.delete('/api/users/:id', csrfProtection, deleteUser);
```

### Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

// General rate limit
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts'
    }
  }
});

app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);
```

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

# Use lock files
npm ci  # Use package-lock.json in CI/CD
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

### Error Handling

```javascript
// ❌ DON'T: Expose internal errors
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.stack  // Exposes internal details
  });
});

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
      correlationId: req.correlationId  // For support
    }
  });
});
```

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
  // Soft delete user
  await User.findByIdAndUpdate(userId, {
    isActive: false,
    deletedAt: new Date(),
    email: `deleted_${userId}@deleted.com`,  // Anonymize
    firstName: 'Deleted',
    lastName: 'User'
  });

  // Anonymize related data
  await Order.updateMany(
    { userId },
    { $set: { userId: null, customerName: 'Deleted User' } }
  );
}
```

### Audit Logging

```javascript
// Log all sensitive operations
export async function auditLog(action, userId, details) {
  await AuditLog.create({
    action,
    userId,
    details,
    timestamp: new Date(),
    ipAddress: details.ipAddress,
    userAgent: details.userAgent
  });
}

// Usage
await auditLog('USER_CREATED', user._id, {
  email: user.email,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent']
});

await auditLog('USER_DELETED', userId, {
  reason: 'GDPR request',
  deletedBy: req.user.userId
});
```

## Incident Response

### Security Incident Playbook

#### 1. Detection
- Monitor security alerts
- Review audit logs
- Check for anomalies

#### 2. Containment
- Isolate affected systems
- Revoke compromised tokens
- Block malicious IPs

#### 3. Investigation
- Analyze logs and traces
- Identify root cause
- Assess impact

#### 4. Recovery
- Fix vulnerabilities
- Restore from backups
- Deploy security patches

#### 5. Post-Incident
- Document findings
- Update security policies
- Conduct team review

### Emergency Response

```bash
# Revoke all JWT tokens (rotate secret)
kubectl set env deployment/user-service JWT_SECRET=<new-secret>

# Block malicious IP
# Add to rate limiter or firewall

# Restart service
kubectl rollout restart deployment/user-service

# Check logs for security events
kubectl logs -f deployment/user-service | grep -i "security\|unauthorized\|forbidden"
```

## Next Steps

- [API Reference](API.md) - Understand authenticated endpoints
- [Configuration Guide](CONFIGURATION.md) - Set up security settings
- [Deployment Guide](DEPLOYMENT.md) - Deploy with security best practices
- [Monitoring Guide](MONITORING.md) - Monitor security events
