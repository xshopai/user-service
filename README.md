# 👤 User Service

User management microservice for xShop.ai - handles user profiles, authentication data, preferences, and account lifecycle.

**Tech Stack**: Node.js 20, Express 5, MongoDB 8 | **Port**: 1002 | **Dapr App ID**: user-service

##  Documentation

| Document | Description |
|----------|-------------|
| [📖 Developer Guide](docs/DEVELOPMENT.md) | Local setup, debugging, workflows |
| [🏗️ Architecture](docs/ARCHITECTURE.md) | Design patterns and decisions |
| [📡 API Reference](docs/API.md) | Complete API documentation |
| [🚀 Deployment](docs/DEPLOYMENT.md) | Azure, Docker, Kubernetes |
| [🧪 Testing](docs/TESTING.md) | Test strategies and coverage |
| [⚙️ Configuration](docs/CONFIGURATION.md) | Environment variables and Dapr |
| [📊 Monitoring](docs/MONITORING.md) | Observability and debugging |
| [🔒 Security](docs/SECURITY.md) | Security practices and auth |
| [🤝 Contributing](docs/CONTRIBUTING.md) | How to contribute |

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

