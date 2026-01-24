# Prerequisites & Common Setup

This guide covers the common prerequisites and setup steps required for local development of the User Service. Complete these steps before proceeding to either:

- [Local Development (without Dapr)](LOCAL_DEVELOPMENT.md)
- [Local Development with Dapr](LOCAL_DEVELOPMENT_DAPR.md)

---

## Prerequisites

Before you begin, ensure you have the following installed:

| Tool                    | Version | Download                                                      |
| ----------------------- | ------- | ------------------------------------------------------------- |
| Node.js                 | 16+     | [nodejs.org](https://nodejs.org/en/download/)                 |
| npm                     | 8+      | Included with Node.js                                         |
| Git                     | Latest  | [git-scm.com](https://git-scm.com/downloads)                  |
| Docker & Docker Compose | Latest  | [docker.com](https://www.docker.com/products/docker-desktop/) |

---

## Step 1: Clone the Repository

```bash
git clone https://github.com/xshopai/user-service.git
cd user-service
```

---

## Step 2: Install Node.js Dependencies

```bash
# Install dependencies
npm install

# Or using yarn
yarn install
```

This will install all dependencies defined in `package.json`, including:

- **Express** - Web framework
- **Mongoose** - MongoDB ODM
- **bcrypt** - Password hashing
- **jsonwebtoken** - JWT handling
- **winston** - Logging
- **@dapr/dapr** - Dapr SDK

---

## Step 3: Set Up MongoDB Database

### Option A: Using Docker Compose (Recommended)

```bash
# Create the Docker network (first time only)
docker network create xshopai-network

# Start MongoDB using docker-compose
docker-compose up -d user-mongodb
```

This uses the pre-configured settings from `docker-compose.yml`:

- Database: `user_service_db`
- User: `admin` / Password: `admin123`
- Port: `27018`

### Option B: Using Docker Run

```bash
docker run --name user-mongodb \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=admin123 \
  -e MONGO_INITDB_DATABASE=user_service_db \
  -p 27018:27017 \
  -d mongo:8
```

### Option C: Using Local MongoDB Installation

```bash
# Connect to MongoDB
mongosh

# Create database and user
use user_service_db
db.createUser({
  user: "admin",
  pwd: "admin123",
  roles: [{ role: "readWrite", db: "user_service_db" }]
})
```

### Verify MongoDB is Running

```bash
# Check container is running
docker ps | grep mongo

# Test connection (using Docker exec)
docker exec user-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin --eval "db.stats()"

# Or connect interactively
docker exec -it user-mongodb mongosh -u admin -p admin123 --authenticationDatabase admin
```

---

## Step 4: Set Up RabbitMQ Message Broker

> **Note**: RabbitMQ is a shared infrastructure component used by multiple services. You only need to create it once. Skip this step if RabbitMQ is already running.

### Using Docker

```bash
docker run --name xshopai-rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=guest \
  -e RABBITMQ_DEFAULT_PASS=guest \
  -d rabbitmq:3-management
```

### Verify RabbitMQ is Running

```bash
# Check container status
docker ps | grep rabbitmq

# Access management UI (optional)
# Open http://localhost:15672 in browser
# Login: guest/guest
```

---

## Step 5: Configure Environment Variables

Copy the example environment file and edit with your local settings:

```bash
# Copy example env file
cp .env.example .env
```

Edit the `.env` file with your local settings:

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

# Dapr Configuration
DAPR_HOST=localhost
DAPR_HTTP_PORT=3502
DAPR_GRPC_PORT=50002
DAPR_APP_ID=user-service
DAPR_PUBSUB_NAME=event-pubsub

# JWT Configuration
JWT_SECRET=8tDBDMcpxroHoHjXjk8xp/uAn8rzD4y8ZZremFkC4gI=
JWT_ALGORITHM=HS256
JWT_EXPIRES_IN=24h
```

---

## Step 6: Verify Setup

### Run All Verification Commands

```bash
# Verify Node.js
node --version  # Should be v16+

# Verify npm
npm --version   # Should be 8+

# Verify MongoDB is running
docker ps | grep mongo

# Verify RabbitMQ is running (if using Dapr mode)
docker ps | grep rabbitmq

# Verify dependencies installed
npm list --depth=0
```

---

## Quick Start with Docker Compose

Start MongoDB with a single command:

```bash
# Start MongoDB
docker-compose up -d user-mongodb

# Verify it's running
docker-compose ps
```

> **Note**: RabbitMQ must be started separately using `docker run` (see Step 4) as it's a shared component.

---

## Next Steps

Once you've completed these prerequisites, proceed to:

- **[Local Development (without Dapr)](LOCAL_DEVELOPMENT.md)** - Simple setup for basic API development
- **[Local Development with Dapr](LOCAL_DEVELOPMENT_DAPR.md)** - Production-like setup with full event publishing
