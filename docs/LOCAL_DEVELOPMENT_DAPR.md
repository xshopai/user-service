# Local Development with Dapr

This guide shows how to run the User Service locally **with Dapr sidecar** for a production-like environment with event-driven messaging.

> **📋 Prerequisites**: Complete the [Prerequisites & Common Setup](PREREQUISITES.md) before following this guide.

---

## Overview

This setup uses:

- **Dapr sidecar** for service-to-service communication and pub/sub messaging
- **RabbitMQ** as the Dapr pub/sub backing store
- Production-like event handling with proper dead letter queues

For simpler development without Dapr, see [Local Development (without Dapr)](LOCAL_DEVELOPMENT.md).

---

## Additional Prerequisites for Dapr

| Tool     | Version | Installation                                                               |
| -------- | ------- | -------------------------------------------------------------------------- |
| Dapr CLI | 1.12+   | [Install Dapr CLI](https://docs.dapr.io/getting-started/install-dapr-cli/) |

---

## Step 1: Initialize Dapr

```bash
# Initialize Dapr (one-time setup)
dapr init

# Verify Dapr installation
dapr --version

# Check Dapr containers are running
docker ps | grep dapr
```

You should see these containers:

- `dapr_redis`
- `dapr_zipkin`
- `dapr_placement`
- `dapr_scheduler`

---

## Step 2: Configure Environment for Dapr Mode

Copy the Dapr environment template to `.env`:

```bash
# On Linux / Mac / Bash:
cp .env.dapr .env

# On Windows (PowerShell):
Copy-Item .env.dapr .env
```

The `.env.dapr` file contains:

```bash
NODE_ENV=development
PORT=8002
NAME=user-service
VERSION=1.0.0

LOG_LEVEL=debug
LOG_FORMAT=console
LOG_TO_CONSOLE=true
LOG_TO_FILE=false
LOG_FILE_PATH=./logs/user-service.log

# Dapr Configuration
DAPR_HOST=localhost
DAPR_HTTP_PORT=3500
DAPR_GRPC_PORT=50001
DAPR_APP_ID=user-service
DAPR_PUBSUB_NAME=event-pubsub

# Service Tokens (for service-to-service communication)
AUTH_SERVICE_TOKEN=svc-auth-service-4ff5876fc86cc45a18d88e5d
ADMIN_SERVICE_TOKEN=svc-admin-service-4ff5876fc86cc45a18d88e5d
ORDER_SERVICE_TOKEN=svc-order-service-4ff5876fc86cc45a18d88e5d
WEB_BFF_TOKEN=svc-web-bff-4ff5876fc86cc45a18d88e5d
```

> **Note**:
>
> - When using Dapr mode, `DATABASE_URL` and `JWT_SECRET` are retrieved from the Dapr secret store (configured in `.dapr/secrets.json`)
> - The Dapr sidecar handles RabbitMQ connections using the configuration in `.dapr/components/event-bus.yaml`
> - If Dapr secret store fails, the service falls back to `DATABASE_URL` environment variable

---

## Step 3: Verify Dapr Component Files

The repository includes pre-configured Dapr components in `.dapr/components/`:

```bash
# List component files
ls -la .dapr/components/

# You should see:
# - event-bus.yaml (RabbitMQ pub/sub)
# - subscriptions.yaml (Event subscriptions)
# - secret-store.yaml (Local secrets)
```

---

## Step 4: Configure Dapr Secrets (Optional)

If using Dapr secret store, create `.dapr/secrets.json`:

```json
{
  "DATABASE_URL": "mongodb://admin:admin123@localhost:27018/user_service_db?authSource=admin",
  "JWT_SECRET": "8tDBDMcpxroHoHjXjk8xp/uAn8rzD4y8ZZremFkC4gI="
}
```

> **Note:** Use UPPER_SNAKE_CASE for secret names to match platform conventions (`.env` files, inventory-service, etc.).

> **Security Note:** This file is gitignored. Never commit secrets.json to version control.

---

## Step 5: Start Service with Dapr Sidecar

### Option A: Using npm scripts (Recommended)

```bash
# Start the development server with Dapr and hot reload
npm run dev:dapr

# Or for production mode with Dapr
npm run start:dapr

# Or with debugger attached
npm run debug:dapr
```

### Option B: Using convenience scripts

```bash
# On Linux / Mac / Bash:
./run.sh

# On Windows (PowerShell):
.\run.ps1
```

---

## Step 6: Verify Dapr Integration

```bash
# Check Dapr sidecar metadata
curl http://localhost:3500/v1.0/metadata

# Check service health
curl http://localhost:8002/health

# Expected metadata response shows:
# - app-id: user-service
# - Configured components (event-bus, etc.)
```

---

## Dapr Dashboard (Optional)

```bash
# Start Dapr Dashboard
dapr dashboard

# Access at http://localhost:8080
```

The dashboard shows:

- Running Dapr applications
- Component status
- Pub/sub subscriptions
- Service invocations

---

## Stopping the Service

```bash
# Stop Dapr sidecar and application
dapr stop --app-id user-service

# Or use VS Code task: "Stop Dapr Sidecar"
```

---

## Dapr Component Configuration Reference

### Event Bus (RabbitMQ)

File: `.dapr/components/event-bus.yaml`

```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: event-bus
spec:
  type: pubsub.rabbitmq
  version: v1
  metadata:
    - name: connectionString
      value: 'amqp://guest:guest@127.0.0.1:5672'
    - name: consumerID
      value: 'user-service'
    - name: durable
      value: 'true'
    - name: deletedWhenUnused
      value: 'false'
    - name: autoAck
      value: 'false'
    - name: deliveryMode
      value: '2'
    - name: requeueInFailure
      value: 'true'
    - name: prefetchCount
      value: '10'
    - name: reconnectWait
      value: '5'
    - name: concurrencyMode
      value: 'parallel'
    - name: publisherConfirm
      value: 'false'
    - name: enableDeadLetter
      value: 'true'
    - name: exchangeKind
      value: 'topic'
scopes:
  - user-service
```

**Key Configuration Options:**

| Attribute          | Value                    | Description                                         |
| ------------------ | ------------------------ | --------------------------------------------------- |
| `connectionString` | `amqp://guest:guest@...` | RabbitMQ connection (matches container credentials) |
| `consumerID`       | `user-service`           | Consumer group identity                             |
| `durable`          | `true`                   | Queues persist across RabbitMQ restarts             |
| `autoAck`          | `false`                  | Manual acknowledgment for reliability               |
| `deliveryMode`     | `2`                      | Persistent messages (survives broker restart)       |
| `requeueInFailure` | `true`                   | Requeue failed messages for retry                   |
| `prefetchCount`    | `10`                     | Messages prefetched per consumer                    |
| `concurrencyMode`  | `parallel`               | Process multiple messages concurrently              |
| `enableDeadLetter` | `true`                   | Failed messages go to dead letter queue             |
| `exchangeKind`     | `topic`                  | Topic-based routing for flexibility                 |

> **Note**: See [Dapr RabbitMQ documentation](https://docs.dapr.io/reference/components-reference/supported-pubsub/setup-rabbitmq/) for all available options.

---

## Published Events

User Service publishes these events via Dapr pub/sub:

| Event              | Topic              | Description                  |
| ------------------ | ------------------ | ---------------------------- |
| `user.updated`     | `user.updated`     | User profile was updated     |
| `user.deleted`     | `user.deleted`     | User account was deleted     |
| `user.deactivated` | `user.deactivated` | User account was deactivated |
| `user.reactivated` | `user.reactivated` | User account was reactivated |

> **Note**: `user.created` is published by auth-service, not user-service.

---

## Next Steps

- Review the [Architecture Documentation](ARCHITECTURE.md)
- See [API Documentation](API.md) for endpoint details
