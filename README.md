# 👤 User Service

User management microservice for xShop.ai - handles user profiles, authentication data, preferences, and account lifecycle.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ ([Download](https://nodejs.org/))
- **MongoDB** 8+ ([Download](https://www.mongodb.com/try/download/community))
- **Dapr CLI** 1.16+ ([Install Guide](https://docs.dapr.io/getting-started/install-dapr-cli/))
- **Docker** (optional, for containerized MongoDB)

### Setup

**1. Start MongoDB**
```bash
# Using Docker (recommended)
docker run -d --name user-mongodb -p 27018:27017 mongo:8

# Or install MongoDB locally and ensure it's running
```

**2. Clone & Install**
```bash
git clone https://github.com/xshopai/user-service.git
cd user-service
npm install
```

**3. Configure Environment**
```bash
# Copy environment template
cp .env.example .env

# Edit .env - update these values:
# MONGODB_URI=mongodb://localhost:27018/user_service_db
# JWT_SECRET=your-secret-key-change-in-production
```

**4. Initialize Dapr**
```bash
# First time only
dapr init
```

**5. Run Service**
```bash
# Start with Dapr (recommended)
npm run dev

# Or use platform-specific scripts
./run.sh       # Linux/Mac
.\run.ps1      # Windows
```

**6. Verify**
```bash
# Check health
curl http://localhost:1002/health

# Should return: {"status":"UP","service":"user-service"...}

# Via Dapr
curl http://localhost:3502/v1.0/invoke/user-service/method/health
```

### Common Commands

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Lint code
npm run lint

# Debug mode
npm run dev:debug

# Production mode
npm start
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [📖 Developer Guide](docs/DEVELOPER_GUIDE.md) | Local setup, debugging, daily workflows |
| [📘 Technical Reference](docs/TECHNICAL.md) | Architecture, security, monitoring |

**API Documentation**: See `src/routes/` for endpoint definitions and `tests/integration/` for API contract examples.

## ⚙️ Configuration

### Required Environment Variables

```bash
# Service
NODE_ENV=development              # Environment: development, production, test
PORT=1002                         # HTTP server port

# Database
MONGODB_URI=mongodb://localhost:27018/user_service_db

# Security
JWT_SECRET=your-secret-key        # JWT signing secret (32+ characters)
JWT_EXPIRY=24h                    # Token expiration

# Dapr
DAPR_HTTP_PORT=3502              # Dapr sidecar HTTP port
DAPR_GRPC_PORT=50002             # Dapr sidecar gRPC port
```

See [.env.example](.env.example) for complete configuration options.

## ✨ Key Features

- User profile management (CRUD operations)
- Social identity linking (Google, Facebook, Twitter)
- Email verification and password management
- Address and payment method storage
- Wishlist and preferences management
- Event publishing for user lifecycle changes
- Role-based access control (RBAC)
- Comprehensive audit logging

## 🔗 Related Services

- [auth-service](https://github.com/xshopai/auth-service) - Authentication and JWT issuance
- [admin-service](https://github.com/xshopai/admin-service) - Admin operations
- [audit-service](https://github.com/xshopai/audit-service) - Audit logging

## 📄 License

MIT License - see [LICENSE](LICENSE)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/xshopai/user-service/issues)
- **Discussions**: [GitHub Discussions](https://github.com/xshopai/user-service/discussions)
- **Documentation**: [docs/](docs/)

