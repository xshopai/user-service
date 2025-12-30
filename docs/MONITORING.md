# Monitoring & Observability Guide

Comprehensive monitoring, logging, and observability documentation for the User Service.

## Table of Contents

- [Logging](#logging)
- [Metrics](#metrics)
- [Distributed Tracing](#distributed-tracing)
- [Health Checks](#health-checks)
- [Alerts](#alerts)
- [Debugging](#debugging)
- [Performance Monitoring](#performance-monitoring)

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

### Log Format

#### Structured JSON Logging

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

**File**: `src/utils/logger.js`

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
    // Console logging
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File logging
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/combined.log'
    })
  ]
});

export default logger;
```

### Usage Examples

```javascript
import logger from './utils/logger.js';

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

// Debug logging
logger.debug('Processing user request', {
  userId: req.params.userId,
  method: req.method,
  path: req.path
});

// Warning logging
logger.warn('High request rate detected', {
  userId: req.user.id,
  requestCount: requestCount,
  threshold: rateLimit
});
```

### Correlation IDs

Every request is assigned a correlation ID for tracing:

```javascript
// Middleware to add correlation ID
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

### Log Aggregation

#### Local Development

```bash
# Tail logs
tail -f logs/combined.log

# Filter by level
grep -i "error" logs/combined.log

# Search by correlation ID
grep "abc123-def456" logs/combined.log
```

#### Production (Azure)

- **Azure Application Insights**: Automatic log ingestion
- **Log Analytics Workspace**: Query logs with KQL

**KQL Query Example**:
```kusto
traces
| where customDimensions.service == "user-service"
| where severityLevel >= 3  // ERROR and above
| where timestamp > ago(1h)
| project timestamp, message, customDimensions.correlationId
| order by timestamp desc
```

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
- **Cache Hit Rate**: Redis cache effectiveness

#### System Metrics
- **CPU Usage**: Percentage
- **Memory Usage**: Heap size, RSS
- **Event Loop Lag**: Node.js event loop delay
- **Active Connections**: Current HTTP connections

### Metrics Implementation

**Using Prometheus Client**:

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

const userOperations = new prometheus.Counter({
  name: 'user_operations_total',
  help: 'Total user operations',
  labelNames: ['operation', 'status']
});
register.registerMetric(userOperations);

// Metrics middleware
export const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  
  next();
};

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

### Metrics Dashboard

Access metrics at: `http://localhost:1002/metrics`

**Example Output**:
```
# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1",method="POST",route="/api/users",status_code="201"} 45
http_request_duration_seconds_bucket{le="0.5",method="POST",route="/api/users",status_code="201"} 98
http_request_duration_seconds_sum{method="POST",route="/api/users",status_code="201"} 24.5
http_request_duration_seconds_count{method="POST",route="/api/users",status_code="201"} 100

# HELP user_operations_total Total user operations
# TYPE user_operations_total counter
user_operations_total{operation="create",status="success"} 150
user_operations_total{operation="create",status="failure"} 5
```

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

#### Start Zipkin

```bash
docker run -d -p 9411:9411 openzipkin/zipkin
```

#### View Traces

Open: `http://localhost:9411`

**What You'll See**:
- Request flow across services
- Service dependencies
- Performance bottlenecks
- Error traces

### Manual Tracing

Add custom spans:

```javascript
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('user-service');

export async function createUser(userData) {
  const span = tracer.startSpan('createUser');
  
  try {
    span.setAttribute('user.email', userData.email);
    
    // Your logic here
    const user = await User.create(userData);
    
    span.setStatus({ code: SpanStatusCode.OK });
    return user;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
```

## Health Checks

### Health Endpoints

#### 1. Health Check (`/health`)

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

#### 2. Readiness Check (`/ready`)

Service ready to accept traffic:

```http
GET /ready
```

**Response**:
```json
{
  "ready": true,
  "checks": {
    "database": "ready",
    "dapr": "ready"
  }
}
```

#### 3. Liveness Check (`/live`)

Service is alive (for Kubernetes):

```http
GET /live
```

**Response**:
```json
{
  "alive": true
}
```

### Health Check Implementation

```javascript
import mongoose from 'mongoose';

export async function healthCheck() {
  const health = {
    status: 'UP',
    service: 'user-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dependencies: {}
  };

  // Check database
  try {
    if (mongoose.connection.readyState === 1) {
      health.dependencies.database = 'UP';
    } else {
      health.dependencies.database = 'DOWN';
      health.status = 'DOWN';
    }
  } catch (error) {
    health.dependencies.database = 'DOWN';
    health.status = 'DOWN';
  }

  // Check Dapr
  try {
    const daprResponse = await fetch(`http://localhost:${process.env.DAPR_HTTP_PORT}/v1.0/healthz`);
    health.dependencies.dapr = daprResponse.ok ? 'UP' : 'DOWN';
  } catch (error) {
    health.dependencies.dapr = 'DOWN';
  }

  return health;
}
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

3. **Rate Limit Exceeded**
   - Condition: Rate limit hit > 100 times/minute
   - Action: Log warning

### Alert Configuration

**Azure Monitor Alert Example**:

```json
{
  "name": "user-service-high-error-rate",
  "description": "Alert when error rate exceeds 5%",
  "severity": 2,
  "enabled": true,
  "condition": {
    "allOf": [
      {
        "query": "traces | where customDimensions.service == 'user-service' and severityLevel >= 3 | summarize ErrorCount = count() by bin(timestamp, 5m)",
        "timeAggregation": "Average",
        "operator": "GreaterThan",
        "threshold": 5
      }
    ]
  },
  "actions": {
    "actionGroups": ["slack-alerts", "email-oncall"]
  }
}
```

## Debugging

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

### Common Debugging Scenarios

#### 1. Slow Requests

```javascript
// Add timing logs
logger.debug('Starting user creation', { correlationId });
const startTime = Date.now();

const user = await User.create(userData);

const duration = Date.now() - startTime;
logger.debug('User created', { correlationId, duration });

if (duration > 1000) {
  logger.warn('Slow user creation', { correlationId, duration });
}
```

#### 2. Database Queries

```javascript
// Enable Mongoose query logging
mongoose.set('debug', true);

// Or custom query logging
UserSchema.post('save', function(doc) {
  logger.debug('User saved', {
    userId: doc._id,
    duration: this.$__.$__.saveTime
  });
});
```

#### 3. Memory Leaks

```bash
# Take heap snapshot
node --inspect src/server.js

# Connect Chrome DevTools to chrome://inspect
# Take heap snapshot in Memory tab
```

#### 4. Request Tracing

View full request trace in Zipkin:
1. Open `http://localhost:9411`
2. Search by correlation ID
3. Analyze service call chain

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

### Performance Dashboard

**Grafana Dashboard Example**:

```json
{
  "dashboard": {
    "title": "User Service Performance",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{
          "expr": "rate(http_requests_total[5m])"
        }]
      },
      {
        "title": "Response Time (p95)",
        "targets": [{
          "expr": "histogram_quantile(0.95, http_request_duration_seconds_bucket)"
        }]
      },
      {
        "title": "Error Rate",
        "targets": [{
          "expr": "rate(http_requests_total{status_code=~\"5..\"}[5m])"
        }]
      }
    ]
  }
}
```

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

4. **Implement Request Batching**
   ```javascript
   const users = await User.find({ _id: { $in: userIds } });
   ```

## Next Steps

- [Development Guide](DEVELOPMENT.md) - Set up logging locally
- [Configuration Guide](CONFIGURATION.md) - Configure log levels
- [Deployment Guide](DEPLOYMENT.md) - Set up monitoring in production
