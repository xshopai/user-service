# User Service - Architecture Document

## Table of Contents

1. [Overview](#1-overview)
   - 1.1 [Purpose](#11-purpose)
   - 1.2 [Scope](#12-scope)
   - 1.3 [Service Summary](#13-service-summary)
   - 1.4 [Directory Structure](#14-directory-structure)
   - 1.5 [Key Responsibilities](#15-key-responsibilities)
   - 1.6 [References](#16-references)
2. [System Context](#2-system-context)
   - 2.1 [Context Diagram](#21-context-diagram)
   - 2.2 [External Interfaces](#22-external-interfaces)
   - 2.3 [Dependencies](#23-dependencies)
3. [Data Architecture](#3-data-architecture)
   - 3.1 [Entity Relationship Diagram](#31-entity-relationship-diagram)
   - 3.2 [Database Schema](#32-database-schema)
   - 3.3 [Indexes](#33-indexes)
   - 3.4 [Caching Strategy](#34-caching-strategy)
   - 3.5 [Database Configuration](#35-database-configuration)
4. [API Design](#4-api-design)
   - 4.1 [Endpoint Summary](#41-endpoint-summary)
   - 4.2 [Request/Response Specifications](#42-requestresponse-specifications)
   - 4.3 [Error Response Format](#43-error-response-format)
   - 4.4 [Error Code Reference](#44-error-code-reference)
   - 4.5 [Authentication](#45-authentication)
5. [Event Architecture](#5-event-architecture)
   - 5.1 [Event Summary](#51-event-summary)
   - 5.2 [Published Events](#52-published-events)
   - 5.3 [Subscribed Events](#53-subscribed-events)
   - 5.4 [Dapr Configuration](#54-dapr-configuration)
   - 5.5 [Messaging Abstraction Layer](#55-messaging-abstraction-layer)
6. [Configuration](#6-configuration)
   - 6.1 [Environment Variables](#61-environment-variables)
   - 6.2 [Messaging Provider Configuration](#62-messaging-provider-configuration)
7. [Deployment](#7-deployment)
   - 7.1 [Deployment Targets](#71-deployment-targets)
8. [Observability](#8-observability)
   - 8.1 [Distributed Tracing](#81-distributed-tracing)
   - 8.2 [Structured Logging](#82-structured-logging)
   - 8.3 [Metrics & Alerting](#83-metrics--alerting)
9. [Error Handling](#9-error-handling)
   - 9.1 [Error Response Format](#91-error-response-format)
10. [Security](#10-security)
    - 10.1 [Authentication](#101-authentication)
    - 10.2 [Authorization](#102-authorization)
    - 10.3 [Service-to-Service Communication](#103-service-to-service-communication)
    - 10.4 [Input Validation](#104-input-validation)
    - 10.5 [CORS Configuration](#105-cors-configuration)

---

## 1. Overview

### 1.1 Purpose

The User Service is a core microservice within the xshopai e-commerce platform responsible for managing all user-related data, profiles, and account lifecycle operations. It serves as the **single source of truth** for user information and provides both synchronous APIs and event-driven integration patterns for user management.

### 1.2 Scope

#### In Scope

- User registration and account creation
- User profile management (CRUD operations)
- Address management (shipping/billing addresses)
- Payment method management (secure storage)
- Wishlist management
- User preferences configuration
- Role-based access control (customer, admin)
- Account activation/deactivation
- Event-driven notifications for user lifecycle events
- Admin operations for user support

#### Out of Scope

- Authentication (handled by Auth Service)
- Password reset/recovery (handled by Auth Service)
- Session management (handled by Auth Service)
- Order history (handled by Order Service)
- Shopping cart management (handled by Cart Service)
- Email verification workflows (handled by Notification Service)
- Payment processing (handled by Payment Service)

### 1.3 Service Summary

| Attribute      | Value                             |
| -------------- | --------------------------------- |
| Service Name   | user-service                      |
| Tech Stack     | Node.js 16+ / Express 5.1.0       |
| Database       | MongoDB 8.x (Mongoose 8.18.0 ODM) |
| Authentication | JWT (validated by auth-service)   |
| API Docs       | OpenAPI/Swagger                   |
| Messaging      | Dapr Pub/Sub (RabbitMQ backend)   |
| Main Port      | 8002                              |
| Dapr HTTP Port | 3500                              |
| Dapr gRPC Port | 50001                             |

> **Note:** All services now use the standard Dapr ports (3500 for HTTP, 50001 for gRPC). This simplifies configuration and works consistently whether running via Docker Compose or individual service runs.

### 1.4 Directory Structure

```
user-service/
├── .dapr/                      # Dapr configuration
│   ├── components/             # Pub/sub, state store, secret store
│   │   ├── event-bus.yaml      # RabbitMQ pub/sub component
│   │   ├── secret-store.yaml   # Local secrets component
│   │   └── state-store.yaml    # State store component
│   ├── config.yaml             # Dapr configuration
│   └── secrets.json            # Local secrets (gitignored)
├── .github/                    # GitHub workflows and copilot instructions
├── .vscode/                    # VS Code settings and tasks
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md         # This file
│   ├── PRD.md                  # Product requirements document
│   └── ...                     # Other documentation
├── infra/                      # Infrastructure as Code
├── src/                        # Application source code
│   ├── controllers/            # API endpoint handlers
│   │   ├── user.controller.js
│   │   ├── user.address.controller.js
│   │   ├── user.payment.controller.js
│   │   ├── user.wishlist.controller.js
│   │   ├── admin.controller.js
│   │   └── operational.controller.js
│   ├── core/                   # Core utilities
│   │   ├── config.js           # Configuration management
│   │   ├── errors.js           # Error classes
│   │   └── logger.js           # Winston logger setup
│   ├── database/               # Database connection
│   │   └── index.js            # MongoDB connection setup
│   ├── events/                 # Event publishing
│   │   └── publisher.js        # Dapr event publisher
│   ├── middlewares/            # Express middleware
│   │   ├── asyncHandler.js     # Async error handling
│   │   ├── auth.middleware.js  # JWT authentication
│   │   ├── role.middleware.js  # Role-based authorization
│   │   └── traceContext.middleware.js  # Correlation ID tracking
│   ├── models/                 # Mongoose models
│   │   └── user.model.js       # User model with subdocuments
│   ├── routes/                 # Route definitions
│   │   ├── user.routes.js
│   │   ├── admin.routes.js
│   │   └── operational.routes.js
│   ├── schemas/                # Reusable subdocument schemas
│   │   ├── address.schema.js
│   │   ├── payment.schema.js
│   │   ├── wishlist.schema.js
│   │   └── preferences.schema.js
│   ├── services/               # Business logic layer
│   │   └── user.service.js
│   ├── validators/             # Input validation
│   │   └── user.validator.js
│   ├── app.js                  # Express app configuration
│   └── server.js               # Application entry point
├── tests/                      # Test suite
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── e2e/                    # End-to-end tests
├── docker-compose.yml          # Local development setup
├── Dockerfile                  # Container build instructions
├── package.json                # Dependencies and scripts
├── run.ps1                     # Windows run script
└── run.sh                      # Linux/macOS run script
```

### 1.5 Key Responsibilities

1. **User Profile Management** - Store and manage user profiles including personal information, contact details, and preferences
2. **Address Management** - Support multiple shipping and billing addresses per user with default designation
3. **Payment Method Management** - Securely store payment method references (last 4 digits, expiry)
4. **Wishlist Management** - Allow users to save products to their wishlist
5. **Event Publishing** - Publish `user.updated`, `user.deleted` events for downstream services
6. **Admin Operations** - Support user lookup, statistics, and administrative management

### 1.6 References

| Document             | Link                                                                  |
| -------------------- | --------------------------------------------------------------------- |
| PRD                  | [docs/PRD.md](./PRD.md)                                               |
| Copilot Instructions | [.github/copilot-instructions.md](../.github/copilot-instructions.md) |

---

## 2. System Context

### 2.1 Context Diagram

```mermaid
flowchart TB
    subgraph Users["<b>👤 USERS</b>"]
        Customer[("👤 Customer")]
        Admin[("🧑‍💼 Admin User")]
    end

    subgraph Clients["<b>📱 CLIENT APPLICATIONS</b>"]
        CustomerUI["🛍️ Customer UI<br/><i>Web/Mobile</i>"]
        AdminUI["🖥️ Admin UI<br/><i>Web Interface</i>"]
    end

    subgraph BFF["<b>🌐 BACKEND FOR FRONTEND</b>"]
        WebBFF["🔀 Web BFF<br/><i>API Gateway</i>"]
    end

    subgraph Core["<b>🎯 CORE SERVICE</b>"]
        USER["<b>User Service</b><br/>━━━━━━━━━━━━━━━<br/>👤 Port: 8002<br/>Manages user profiles,<br/>addresses & preferences"]
    end

    subgraph Services["<b>🔗 DEPENDENT SERVICES</b>"]
        direction LR
        Auth["🔐 Auth Service<br/><i>JWT Authentication</i>"]
        Order["🛒 Order Service<br/><i>Order Processing</i>"]
        AdminSvc["🛡️ Admin Service<br/><i>Admin Operations</i>"]
        Notification["🔔 Notification Service<br/><i>Email/SMS</i>"]
    end

    subgraph EventConsumers["<b>📤 EVENT CONSUMERS</b>"]
        direction LR
        Audit["📋 Audit Service<br/><i>Audit Logging</i>"]
    end

    subgraph Infrastructure["<b>⚙️ INFRASTRUCTURE</b>"]
        direction TB
        MongoDB[("🗄️ MongoDB 8.x<br/>Port: 27018")]
        RabbitMQ[("🐰 RabbitMQ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Message Broker &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Port: 5672")]
        Dapr["📡 Dapr Sidecar<br/>HTTP: 3500"]
        OTEL["📊 OpenTelemetry<br/>Collector"]
    end

    %% User flows
    Customer -->|"Uses"| CustomerUI
    Admin -->|"Uses"| AdminUI
    CustomerUI -->|"HTTP/REST"| WebBFF
    AdminUI -->|"HTTP/REST"| WebBFF
    WebBFF -->|"HTTP/REST<br/>Profile Management"| USER
    WebBFF -->|"HTTP/REST<br/>Admin Operations"| AdminSvc
    AdminSvc -->|"HTTP/REST<br/>User Admin APIs"| USER

    %% Service integrations - HTTP
    Auth -->|"HTTP GET<br/>Get User by Email"| USER
    Order -->|"HTTP GET<br/>Get User Profile"| USER

    %% Auth provides JWT public key at startup (no per-request calls)
    Auth -.->|"JWT Public Key<br/>(startup only)"| WebBFF

    %% Event flows - Outbound (Publisher → Broker → Consumers)
    USER -.->|"Publish"| Dapr
    Dapr -.->|"user.*"| RabbitMQ
    RabbitMQ -.->|"user.*"| Audit

    %% Infrastructure connections
    USER -->|"MongoDB Queries"| MongoDB
    USER -->|"OTLP Traces"| OTEL

    %% Styling - Core Service
    classDef core fill:#0969da,stroke:#0550ae,color:#fff,stroke-width:3px,font-weight:bold

    %% Styling - Users
    classDef user fill:#8250df,stroke:#6639ba,color:#fff,stroke-width:2px

    %% Styling - Client Apps
    classDef client fill:#1f6feb,stroke:#1158c7,color:#fff,stroke-width:2px

    %% Styling - BFF
    classDef bff fill:#6366f1,stroke:#4f46e5,color:#fff,stroke-width:2px

    %% Styling - Dependent Services (different colors by type)
    classDef authSvc fill:#dc2626,stroke:#b91c1c,color:#fff,stroke-width:2px
    classDef orderSvc fill:#0891b2,stroke:#0e7490,color:#fff,stroke-width:2px
    classDef adminSvc fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px
    classDef notifySvc fill:#ea580c,stroke:#c2410c,color:#fff,stroke-width:2px

    %% Styling - Event Consumers
    classDef auditSvc fill:#65a30d,stroke:#4d7c0f,color:#fff,stroke-width:2px

    %% Styling - Infrastructure
    classDef database fill:#059669,stroke:#047857,color:#fff,stroke-width:2px
    classDef broker fill:#f472b6,stroke:#db2777,color:#fff,stroke-width:2px
    classDef messaging fill:#d97706,stroke:#b45309,color:#fff,stroke-width:2px
    classDef observability fill:#0284c7,stroke:#0369a1,color:#fff,stroke-width:2px

    %% Apply styles
    class USER core
    class Customer,Admin user
    class CustomerUI,AdminUI client
    class WebBFF bff
    class Auth authSvc
    class Order orderSvc
    class AdminSvc adminSvc
    class Notification notifySvc
    class Audit auditSvc
    class MongoDB database
    class RabbitMQ broker
    class Dapr messaging
    class OTEL observability
```

#### Diagram Legend

|      Color      | Component                 | Description                   |
| :-------------: | ------------------------- | ----------------------------- |
|   🔵 **Blue**   | User Service              | Core service being documented |
|  🟣 **Purple**  | Customer/Admin Users      | User actors                   |
|   🔷 **Cyan**   | Client UIs                | Frontend applications         |
|   🔴 **Red**    | Auth Service              | Authentication and security   |
|  🟣 **Violet**  | Admin Service             | Admin operations              |
|  🟠 **Orange**  | Notification Service/Dapr | Alerts and messaging sidecar  |
|  🟢 **Green**   | Audit Service / MongoDB   | Logging and data persistence  |
|   🩷 **Pink**   | RabbitMQ                  | Message broker infrastructure |
| 🔵 **Sky Blue** | OpenTelemetry             | Observability infrastructure  |

| Arrow Style       | Meaning                                   |
| ----------------- | ----------------------------------------- |
| **━━━▶** Solid    | Synchronous HTTP/MongoDB request-response |
| **─ ─ ─▶** Dashed | Asynchronous event-based messaging        |

### 2.2 External Interfaces

| System        | Direction | Protocol    | Description                                             |
| ------------- | --------- | ----------- | ------------------------------------------------------- |
| Auth Service  | In        | HTTP        | Queries user by email for authentication                |
| Order Service | In        | HTTP        | Retrieves user profile and addresses for orders         |
| Admin Service | In        | HTTP        | Admin operations (list users, deactivate, delete, etc.) |
| Audit Service | Out       | Dapr Events | Publishes user change events for audit logging          |
| Web BFF       | In        | HTTP        | Self-service profile management (via Customer UI)       |
| MongoDB       | Out       | MongoDB     | Persistent storage for user data                        |

### 2.3 Dependencies

#### 2.3.1 Upstream Dependencies

| Service      | Dependency Type | Purpose              |
| ------------ | --------------- | -------------------- |
| Auth Service | HTTP            | JWT token validation |

#### 2.3.2 Downstream Consumers

| Consumer      | Interface   | Data Provided              |
| ------------- | ----------- | -------------------------- |
| Auth Service  | HTTP        | User lookup by email       |
| Order Service | HTTP        | User profile and addresses |
| Admin Service | HTTP        | User management APIs       |
| Web BFF       | HTTP        | Profile self-service       |
| Audit Service | Dapr Events | All user lifecycle events  |

#### 2.3.3 Infrastructure Dependencies

| Component               | Purpose                       | Port/Connection          |
| ----------------------- | ----------------------------- | ------------------------ |
| MongoDB 8.x             | Persistent storage            | 27018 (configurable)     |
| Dapr Sidecar            | Pub/sub messaging             | HTTP: 3500, gRPC: 50001  |
| RabbitMQ (via Dapr)     | Message broker backend        | Abstracted by Dapr       |
| OpenTelemetry Collector | Distributed tracing & metrics | 4317 (gRPC), 4318 (HTTP) |

---

## 3. Data Architecture

### 3.1 Entity Relationship Diagram

```mermaid
erDiagram
    users ||--o{ addresses : "has"
    users ||--o{ payment_methods : "has"
    users ||--o{ wishlist_items : "has"
    users ||--|| preferences : "has"

    users {
        ObjectId _id PK
        string email UK
        string password
        string firstName
        string lastName
        string phoneNumber
        array roles
        boolean isEmailVerified
        boolean isActive
        string createdBy
        string updatedBy
        datetime createdAt
        datetime updatedAt
    }

    addresses {
        ObjectId _id PK
        enum type
        boolean isDefault
        string fullName
        string addressLine1
        string addressLine2
        string city
        string state
        string postalCode
        string country
        string phoneNumber
    }

    payment_methods {
        ObjectId _id PK
        enum type
        boolean isDefault
        string cardholderName
        string cardLastFour
        number expiryMonth
        number expiryYear
        embedded billingAddress
    }

    wishlist_items {
        ObjectId _id PK
        string productId
        datetime addedAt
        string notes
    }

    preferences {
        boolean emailNotifications
        boolean smsNotifications
        boolean marketingEmails
        string language
        string currency
        enum theme
    }
```

### 3.2 Database Schema

#### 3.2.1 users Collection

| Field             | Type     | Constraints                 | Description                              |
| ----------------- | -------- | --------------------------- | ---------------------------------------- |
| `_id`             | ObjectId | PK, AUTO                    | Primary key                              |
| `email`           | String   | UNIQUE, NOT NULL, INDEX     | User email address (case-insensitive)    |
| `password`        | String   | NOT NULL                    | Bcrypt hashed password (cost factor: 12) |
| `firstName`       | String   | MAX 50                      | User first name                          |
| `lastName`        | String   | MAX 50                      | User last name                           |
| `phoneNumber`     | String   | MAX 20                      | Phone number (E.164 format)              |
| `roles`           | Array    | ENUM['customer', 'admin']   | User roles (default: ['customer'])       |
| `isEmailVerified` | Boolean  | DEFAULT false               | Email verification status                |
| `isActive`        | Boolean  | DEFAULT true                | Account active status                    |
| `addresses`       | Array    | Embedded documents          | Shipping/billing addresses               |
| `paymentMethods`  | Array    | Embedded documents          | Payment method references                |
| `wishlist`        | Array    | Embedded documents          | Wishlist items                           |
| `preferences`     | Object   | Embedded document           | User preferences                         |
| `createdBy`       | String   | DEFAULT 'SELF_REGISTRATION' | Account creator identifier               |
| `updatedBy`       | String   | DEFAULT NULL                | Last modifier identifier                 |
| `createdAt`       | DateTime | AUTO                        | Record creation timestamp                |
| `updatedAt`       | DateTime | AUTO                        | Last modification timestamp              |

#### 3.2.2 addresses Subdocument

| Field          | Type     | Constraints                 | Description               |
| -------------- | -------- | --------------------------- | ------------------------- |
| `_id`          | ObjectId | PK, AUTO                    | Address identifier        |
| `type`         | String   | ENUM['shipping', 'billing'] | Address type              |
| `isDefault`    | Boolean  | DEFAULT false               | Default address for type  |
| `fullName`     | String   | REQUIRED, MAX 100           | Recipient name            |
| `addressLine1` | String   | REQUIRED, MAX 200           | Street address line 1     |
| `addressLine2` | String   | MAX 200                     | Street address line 2     |
| `city`         | String   | REQUIRED, MAX 100           | City name                 |
| `state`        | String   | REQUIRED, MAX 100           | State/province            |
| `postalCode`   | String   | REQUIRED, MAX 20            | Postal/ZIP code           |
| `country`      | String   | REQUIRED, MAX 100           | Country name              |
| `phoneNumber`  | String   | MAX 20                      | Contact phone for address |

#### 3.2.3 paymentMethods Subdocument

| Field            | Type     | Constraints                                 | Description               |
| ---------------- | -------- | ------------------------------------------- | ------------------------- |
| `_id`            | ObjectId | PK, AUTO                                    | Payment method identifier |
| `type`           | String   | ENUM['credit_card', 'debit_card', 'paypal'] | Payment type              |
| `isDefault`      | Boolean  | DEFAULT false                               | Default payment method    |
| `cardholderName` | String   | REQUIRED                                    | Name on card              |
| `cardLastFour`   | String   | REQUIRED, LENGTH 4                          | Last 4 digits (PCI-DSS)   |
| `expiryMonth`    | Number   | REQUIRED, 1-12                              | Card expiry month         |
| `expiryYear`     | Number   | REQUIRED                                    | Card expiry year          |
| `billingAddress` | Object   | Embedded address                            | Billing address           |

#### 3.2.4 wishlist Subdocument

| Field       | Type     | Constraints      | Description              |
| ----------- | -------- | ---------------- | ------------------------ |
| `_id`       | ObjectId | PK, AUTO         | Wishlist item identifier |
| `productId` | String   | REQUIRED         | Product identifier       |
| `addedAt`   | DateTime | DEFAULT Date.now | When item was added      |
| `notes`     | String   | MAX 500          | User notes about item    |

#### 3.2.5 preferences Subdocument

| Field                | Type    | Constraints           | Description                 |
| -------------------- | ------- | --------------------- | --------------------------- |
| `emailNotifications` | Boolean | DEFAULT true          | Receive email notifications |
| `smsNotifications`   | Boolean | DEFAULT false         | Receive SMS notifications   |
| `marketingEmails`    | Boolean | DEFAULT true          | Receive marketing emails    |
| `language`           | String  | DEFAULT 'en'          | Preferred language          |
| `currency`           | String  | DEFAULT 'USD'         | Preferred currency          |
| `theme`              | String  | ENUM['light', 'dark'] | UI theme preference         |

### 3.3 Indexes

| Collection | Index Name     | Fields      | Type   | Purpose                           |
| ---------- | -------------- | ----------- | ------ | --------------------------------- |
| users      | `_id_`         | `_id`       | B-tree | Primary key lookup                |
| users      | `email_1`      | `email`     | B-tree | Unique email lookup (most common) |
| users      | `roles_1`      | `roles`     | B-tree | Role-based filtering              |
| users      | `isActive_1`   | `isActive`  | B-tree | Active user filtering             |
| users      | `createdAt_-1` | `createdAt` | B-tree | Recent users query                |

### 3.4 Caching Strategy

> **Current Status:** Caching is **not implemented** in the current codebase.

| Aspect        | Current State           | Future Recommendation                     |
| ------------- | ----------------------- | ----------------------------------------- |
| Cache Layer   | Not implemented         | Redis with Dapr State Store               |
| User Profiles | Direct database queries | Cache with 5min TTL, invalidate on update |
| Email Lookups | Direct database queries | Cache with 5min TTL                       |

**Database Query Optimization (Current Approach):**

- Indexed queries for all frequent access patterns
- Connection pooling via Mongoose
- Select specific fields to reduce payload size

### 3.5 Database Configuration

Database connection is configured via environment variables parsed in MongoDB URI format.

**Connection String Format:** `mongodb://{user}:{password}@{host}:{port}/{database}?authSource=admin`

---

## 4. API Design

### 4.1 Endpoint Summary

| Method   | Endpoint                           | Description                   | Auth      |
| -------- | ---------------------------------- | ----------------------------- | --------- |
| `GET`    | `/health`                          | Liveness probe                | None      |
| `GET`    | `/health/ready`                    | Readiness probe               | None      |
| `GET`    | `/health/live`                     | Liveness probe                | None      |
| `GET`    | `/metrics`                         | Prometheus metrics            | None      |
| `GET`    | `/`                                | Welcome message               | None      |
| `GET`    | `/version`                         | Service version               | None      |
| `POST`   | `/users`                           | Create new user               | None      |
| `GET`    | `/users/findByEmail`               | Find user by email            | None      |
| `GET`    | `/users`                           | Get authenticated user        | User JWT  |
| `PATCH`  | `/users`                           | Update user profile           | User JWT  |
| `DELETE` | `/users`                           | Delete user account           | User JWT  |
| `GET`    | `/users/addresses`                 | Get all addresses             | User JWT  |
| `POST`   | `/users/addresses`                 | Add new address               | User JWT  |
| `PATCH`  | `/users/addresses/:addressId`      | Update address                | User JWT  |
| `DELETE` | `/users/addresses/:addressId`      | Remove address                | User JWT  |
| `GET`    | `/users/paymentmethods`            | Get all payment methods       | User JWT  |
| `POST`   | `/users/paymentmethods`            | Add payment method            | User JWT  |
| `PATCH`  | `/users/paymentmethods/:paymentId` | Update payment method         | User JWT  |
| `DELETE` | `/users/paymentmethods/:paymentId` | Remove payment method         | User JWT  |
| `GET`    | `/users/wishlist`                  | Get wishlist                  | User JWT  |
| `POST`   | `/users/wishlist`                  | Add item to wishlist          | User JWT  |
| `PATCH`  | `/users/wishlist/:wishlistId`      | Update wishlist item          | User JWT  |
| `DELETE` | `/users/wishlist/:wishlistId`      | Remove from wishlist          | User JWT  |
| `GET`    | `/api/admin/users`                 | List all users (paginated)    | Admin JWT |
| `GET`    | `/api/admin/users/stats`           | Get user statistics           | Admin JWT |
| `GET`    | `/api/admin/users/list/recent`     | Get recently registered users | Admin JWT |
| `GET`    | `/api/admin/users/:id`             | Get user by ID                | Admin JWT |
| `PATCH`  | `/api/admin/users/:id`             | Update user (admin)           | Admin JWT |
| `DELETE` | `/api/admin/users/:id`             | Delete user (admin)           | Admin JWT |

**Authentication Types:**

- **None**: Public endpoints (health checks, registration)
- **User JWT**: Authenticated user operations via JWT (any logged-in user)
- **Admin JWT**: Admin operations requiring `role: admin` in JWT

### 4.2 Request/Response Specifications

#### 4.2.1 Create User

**Endpoint:** `POST /users`

**Authentication:** None (public endpoint)

**Request Body:**

```json
{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1-555-0123"
}
```

| Field         | Type   | Required | Description           |
| ------------- | ------ | -------- | --------------------- |
| `email`       | string | Yes      | Valid email address   |
| `password`    | string | Yes      | Min 6 characters      |
| `firstName`   | string | No       | User first name       |
| `lastName`    | string | No       | User last name        |
| `phoneNumber` | string | No       | Phone in E.164 format |

**Response (201 Created):**

```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["customer"],
    "isEmailVerified": false,
    "isActive": true,
    "createdAt": "2025-10-24T10:30:00Z"
  }
}
```

**Error Responses:**

| Status | Code            | Description              |
| ------ | --------------- | ------------------------ |
| 400    | `INVALID_EMAIL` | Invalid email format     |
| 409    | `EMAIL_EXISTS`  | Email already registered |

---

#### 4.2.2 Get User Profile

**Endpoint:** `GET /users`

**Authentication:** JWT Required

- **Header:** `Authorization: Bearer <jwt_token>`
- **Callers:** Customer UI, Web BFF

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+1-555-0123",
    "roles": ["customer"],
    "isEmailVerified": true,
    "isActive": true,
    "addresses": [],
    "paymentMethods": [],
    "wishlist": [],
    "preferences": {
      "emailNotifications": true,
      "smsNotifications": false,
      "language": "en",
      "currency": "USD",
      "theme": "light"
    },
    "createdAt": "2025-10-24T10:30:00Z",
    "updatedAt": "2025-10-24T10:30:00Z"
  }
}
```

**Error Responses:**

| Status | Code             | Description            |
| ------ | ---------------- | ---------------------- |
| 401    | `UNAUTHORIZED`   | Missing or invalid JWT |
| 404    | `USER_NOT_FOUND` | User does not exist    |

---

#### 4.2.3 Update User Profile

**Endpoint:** `PATCH /users`

**Authentication:** JWT Required

**Request Body:**

```json
{
  "firstName": "Jonathan",
  "phoneNumber": "+1-555-9999",
  "preferences": {
    "emailNotifications": false,
    "theme": "dark"
  }
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "firstName": "Jonathan",
    "phoneNumber": "+1-555-9999",
    "updatedAt": "2025-10-24T11:00:00Z"
  }
}
```

---

#### 4.2.4 Add Address

**Endpoint:** `POST /users/addresses`

**Authentication:** JWT Required

**Request Body:**

```json
{
  "type": "shipping",
  "isDefault": true,
  "fullName": "John Doe",
  "addressLine1": "123 Main St",
  "addressLine2": "Apt 4B",
  "city": "New York",
  "state": "NY",
  "postalCode": "10001",
  "country": "USA",
  "phoneNumber": "+1-555-0123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "Address added successfully",
  "data": {
    "addressId": "addr-123-xyz",
    "type": "shipping",
    "isDefault": true,
    "fullName": "John Doe",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "USA"
  }
}
```

---

#### 4.2.5 List Users (Admin)

**Endpoint:** `GET /admin/users`

**Authentication:** Admin JWT Required

**Query Parameters:**

| Parameter | Type    | Required | Default | Description              |
| --------- | ------- | -------- | ------- | ------------------------ |
| `page`    | integer | No       | 1       | Page number              |
| `limit`   | integer | No       | 20      | Items per page (max 100) |

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "userId": "507f1f77bcf86cd799439011",
        "email": "john.doe@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "roles": ["customer"],
        "isActive": true,
        "createdAt": "2025-10-24T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

### 4.3 Error Response Format

All API errors return a consistent JSON structure:

```json
{
  "success": false,
  "message": "Human-readable error description",
  "errorCode": "ERROR_CODE",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ],
  "correlationId": "req-abc-123-def-456"
}
```

### 4.4 Error Code Reference

| Code                 | HTTP Status | Description                       |
| -------------------- | ----------- | --------------------------------- |
| `VALIDATION_ERROR`   | 400         | Request validation failed         |
| `INVALID_EMAIL`      | 400         | Email format invalid              |
| `PASSWORD_TOO_SHORT` | 400         | Password less than 6 characters   |
| `INVALID_PHONE`      | 400         | Phone number format invalid       |
| `UNAUTHORIZED`       | 401         | Missing or invalid authentication |
| `FORBIDDEN`          | 403         | Insufficient permissions          |
| `USER_NOT_FOUND`     | 404         | User does not exist               |
| `ADDRESS_NOT_FOUND`  | 404         | Address does not exist            |
| `EMAIL_EXISTS`       | 409         | Email already registered          |
| `INTERNAL_ERROR`     | 500         | Unexpected server error           |

### 4.5 Authentication

> **Complete Details:** See **Section 10 - Security** for comprehensive authentication documentation.

**Quick Reference:**

| Auth Type | Header                        | Used By              |
| --------- | ----------------------------- | -------------------- |
| None      | -                             | Health, registration |
| JWT       | `Authorization: Bearer <jwt>` | Customer operations  |
| Admin JWT | `Authorization: Bearer <jwt>` | Admin operations     |

---

## 5. Event Architecture

User Service participates in the xshopai event-driven architecture as a **Pure Publisher** via **Dapr Pub/Sub**.

> **Broker Abstraction:** Dapr Pub/Sub is broker-agnostic. The actual message broker (RabbitMQ, Azure Service Bus, Kafka) is configured at deployment time via Dapr component YAML—no code changes required to switch brokers.

### 5.1 Event Summary

#### Published Events

| Event Name         | Trigger              | Primary Consumer(s)                | Priority |
| ------------------ | -------------------- | ---------------------------------- | -------- |
| `user.created`     | User registration    | Auth Service, Notification Service | High     |
| `user.updated`     | Profile update       | Audit Service                      | Medium   |
| `user.deleted`     | Account deletion     | Cart Service, Audit Service        | High     |
| `user.deactivated` | Account deactivation | Auth Service, Notification Service | High     |
| `user.reactivated` | Account reactivation | Auth Service                       | Medium   |

#### Subscribed Events

User Service is a **Pure Publisher** and does not subscribe to any events.

---

### 5.2 Published Events

All events use **CloudEvents 1.0** envelope with `source: "user-service"`.

#### 5.2.1 user.created

**Trigger:** New user registration

| Consumer             | Purpose                      |
| -------------------- | ---------------------------- |
| Auth Service         | Create authentication record |
| Notification Service | Send welcome email           |
| Audit Service        | Audit trail                  |

**Payload:**

```json
{
  "specversion": "1.0",
  "type": "user.created",
  "source": "user-service",
  "id": "evt-550e8400-e29b-41d4-a716-446655440000",
  "time": "2025-10-24T10:30:00Z",
  "datacontenttype": "application/json",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "roles": ["customer"],
    "createdAt": "2025-10-24T10:30:00Z"
  },
  "metadata": {
    "correlationId": "req-xyz-789",
    "ipAddress": "192.168.1.100",
    "userAgent": "Mozilla/5.0..."
  }
}
```

---

#### 5.2.2 user.updated

**Trigger:** Profile information changed

| Consumer      | Purpose     |
| ------------- | ----------- |
| Audit Service | Audit trail |

**Payload:**

```json
{
  "specversion": "1.0",
  "type": "user.updated",
  "source": "user-service",
  "id": "evt-660e8400-e29b-41d4-a716-446655440001",
  "time": "2025-10-24T11:00:00Z",
  "datacontenttype": "application/json",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "updatedFields": ["firstName", "phoneNumber", "preferences"],
    "updatedAt": "2025-10-24T11:00:00Z",
    "updatedBy": "507f1f77bcf86cd799439011"
  },
  "metadata": {
    "correlationId": "req-abc-123"
  }
}
```

---

#### 5.2.3 user.deleted

**Trigger:** Account deletion

| Consumer      | Purpose           |
| ------------- | ----------------- |
| Cart Service  | Clear user's cart |
| Audit Service | Audit trail       |

**Payload:**

```json
{
  "specversion": "1.0",
  "type": "user.deleted",
  "source": "user-service",
  "id": "evt-770e8400-e29b-41d4-a716-446655440002",
  "time": "2025-10-24T12:00:00Z",
  "datacontenttype": "application/json",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "email": "john.doe@example.com",
    "deletedAt": "2025-10-24T12:00:00Z",
    "deletedBy": "507f1f77bcf86cd799439011",
    "reason": "user_request"
  },
  "metadata": {
    "correlationId": "req-def-456"
  }
}
```

---

#### 5.2.4 user.deactivated

**Trigger:** Account deactivation

| Consumer             | Purpose                    |
| -------------------- | -------------------------- |
| Auth Service         | Invalidate active sessions |
| Notification Service | Send deactivation notice   |

**Payload:**

```json
{
  "specversion": "1.0",
  "type": "user.deactivated",
  "source": "user-service",
  "id": "evt-880e8400-e29b-41d4-a716-446655440003",
  "time": "2025-10-24T13:00:00Z",
  "datacontenttype": "application/json",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "deactivatedAt": "2025-10-24T13:00:00Z",
    "deactivatedBy": "admin-user-123",
    "reason": "terms_violation"
  },
  "metadata": {
    "correlationId": "req-ghi-789"
  }
}
```

---

### 5.3 Subscribed Events

User Service is a **Pure Publisher** and does not subscribe to external events.

---

### 5.4 Dapr Configuration

#### 5.4.1 Pub/Sub Component (RabbitMQ)

File: `.dapr/components/event-bus.yaml`

```yaml
apiVersion: dapr.io/v1alpha1
kind: Component
metadata:
  name: event-pubsub
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

#### 5.4.2 CloudEvents Envelope

All published events use the **CloudEvents 1.0** specification:

```json
{
  "specversion": "1.0",
  "type": "user.created",
  "source": "user-service",
  "id": "evt-550e8400-e29b-41d4-a716-446655440000",
  "time": "2025-10-24T10:30:00Z",
  "datacontenttype": "application/json",
  "traceparent": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
  "correlationid": "req-abc-123",
  "data": {
    // Event-specific payload
  }
}
```

---

### 5.5 Messaging Abstraction Layer

To support **deployment flexibility** across different Azure hosting options, the User Service implements a **Messaging Abstraction Layer** that decouples business logic from specific messaging infrastructure.

#### 5.5.1 Why Abstraction?

| Deployment Target          | Dapr Available | Recommended Provider | Notes                    |
| -------------------------- | -------------- | -------------------- | ------------------------ |
| **Azure Container Apps**   | ✅ Yes         | `DaprProvider`       | Dapr sidecar built-in    |
| **Azure Kubernetes (AKS)** | ✅ Yes         | `DaprProvider`       | Dapr installed via Helm  |
| **Azure App Service**      | ❌ No          | `ServiceBusProvider` | Direct SDK required      |
| **Local Development**      | ✅ Optional    | `DaprProvider`       | Docker Compose with Dapr |
| **Local (No Dapr)**        | ❌ No          | `RabbitMQProvider`   | Direct RabbitMQ SDK      |

#### 5.5.2 Architecture Diagram

```mermaid
flowchart TB
    subgraph UserService["User Service"]
        BL[Business Logic<br/>user.controller.js]
        EP[Event Publisher<br/>publisher.js]
        MAL[Messaging Abstraction Layer<br/>events/]
    end

    subgraph Providers["Provider Implementations"]
        DP[DaprProvider]
        SBP[ServiceBusProvider]
        RMP[RabbitMQProvider]
    end

    subgraph Infrastructure["Messaging Infrastructure"]
        DS[Dapr Sidecar]
        SBSDK[Service Bus SDK]
        RMSDK[RabbitMQ SDK]
    end

    subgraph Backends["Message Brokers"]
        RMQ[RabbitMQ]
        ASB[Azure Service Bus]
        KAFKA[Kafka]
        REDIS[Redis Streams]
    end

    BL --> EP
    EP --> MAL
    MAL --> DP
    MAL --> SBP
    MAL --> RMP

    DP --> DS
    SBP --> SBSDK
    RMP --> RMSDK

    DS -.-> RMQ
    DS -.-> ASB
    DS -.-> KAFKA
    DS -.-> REDIS
    SBSDK --> ASB
    RMSDK --> RMQ

    style UserService fill:#4A90A4,stroke:#2C5F6E,color:#fff
    style MAL fill:#8B5CF6,stroke:#6D28D9,color:#fff
    style DP fill:#10B981,stroke:#059669,color:#fff
    style SBP fill:#3B82F6,stroke:#1D4ED8,color:#fff
    style RMP fill:#F59E0B,stroke:#D97706,color:#fff
    style DS fill:#10B981,stroke:#059669,color:#fff
```

**Key Points:**

- **DaprProvider** → Dapr Sidecar → **Any broker** (RabbitMQ, Service Bus, Kafka, Redis) via Dapr component config
- **ServiceBusProvider** → Azure Service Bus SDK → **Azure Service Bus ONLY**
- **RabbitMQProvider** → amqplib SDK → **RabbitMQ ONLY**

#### 5.5.3 Deployment Configuration Matrix

| Environment Variable           | DaprProvider | ServiceBusProvider | RabbitMQProvider |
| ------------------------------ | ------------ | ------------------ | ---------------- |
| `MESSAGING_PROVIDER`           | `dapr`       | `servicebus`       | `rabbitmq`       |
| `DAPR_PUBSUB_NAME`             | ✅ Required  | ❌ Not used        | ❌ Not used      |
| `DAPR_HTTP_PORT`               | ✅ Required  | ❌ Not used        | ❌ Not used      |
| `SERVICEBUS_CONNECTION_STRING` | ❌ Not used  | ✅ Required        | ❌ Not used      |
| `SERVICEBUS_TOPIC_NAME`        | ❌ Not used  | ✅ Required        | ❌ Not used      |
| `RABBITMQ_URL`                 | ❌ Not used  | ❌ Not used        | ✅ Required      |
| `RABBITMQ_EXCHANGE`            | ❌ Not used  | ❌ Not used        | ⚪ Optional      |

#### 5.5.4 Benefits of Abstraction

| Benefit                    | Description                                                  |
| -------------------------- | ------------------------------------------------------------ |
| **Deployment Flexibility** | Same codebase deploys to App Service, Container Apps, or AKS |
| **No Vendor Lock-in**      | Switch message brokers without code changes                  |
| **Testability**            | Mock provider for unit tests                                 |
| **Local Development**      | Run with or without Dapr sidecar                             |
| **Gradual Migration**      | Start with App Service, migrate to Container Apps when ready |
| **Cost Optimization**      | Choose broker based on pricing and requirements              |

---

## 6. Configuration

### 6.1 Environment Variables

| Variable           | Description                 | Required | Default        |
| ------------------ | --------------------------- | -------- | -------------- |
| `NODE_ENV`         | Environment mode            | No       | `development`  |
| `PORT`             | Service port                | No       | `8002`         |
| `NAME`             | Service name                | No       | `user-service` |
| `VERSION`          | Service version             | No       | `1.0.0`        |
| `LOG_LEVEL`        | Logging level               | No       | `debug`        |
| `LOG_FORMAT`       | Log format (console/json)   | No       | `console`      |
| `DAPR_HOST`        | Dapr sidecar host           | No       | `localhost`    |
| `DAPR_HTTP_PORT`   | Dapr HTTP port              | No       | `3500`         |
| `DAPR_GRPC_PORT`   | Dapr gRPC port              | No       | `50001`        |
| `DAPR_APP_ID`      | Dapr application ID         | No       | `user-service` |
| `DAPR_PUBSUB_NAME` | Dapr pub/sub component name | No       | `pubsub`       |
| `JWT_ALGORITHM`    | JWT algorithm               | No       | `HS256`        |
| `JWT_EXPIRATION`   | JWT expiration in seconds   | No       | `3600`         |

#### MongoDB Configuration

Database connection is configured via individual environment variables:

| Variable              | Description          | Example           |
| --------------------- | -------------------- | ----------------- |
| `MONGODB_HOST`        | MongoDB host         | `localhost`       |
| `MONGODB_PORT`        | MongoDB port         | `27018`           |
| `MONGODB_USERNAME`    | MongoDB username     | `admin`           |
| `MONGODB_PASSWORD`    | MongoDB password     | `admin123`        |
| `MONGODB_DATABASE`    | Database name        | `user_service_db` |
| `MONGODB_AUTH_SOURCE` | Auth source database | `admin`           |

### 6.2 Messaging Provider Configuration

#### 6.2.1 Dapr Provider (Default)

| Variable           | Description            | Required            |
| ------------------ | ---------------------- | ------------------- |
| `DAPR_HTTP_PORT`   | Dapr sidecar HTTP port | No (default: 3500)  |
| `DAPR_GRPC_PORT`   | Dapr sidecar gRPC port | No (default: 50001) |
| `DAPR_PUBSUB_NAME` | Pub/sub component name | Yes                 |

---

## 7. Deployment

### 7.1 Deployment Targets

| Target                 | Messaging Provider | Notes                           |
| ---------------------- | ------------------ | ------------------------------- |
| Local (Docker Compose) | `dapr`             | Uses Dapr sidecar with RabbitMQ |
| Azure Container Apps   | `dapr`             | Managed Dapr integration        |
| AKS                    | `dapr`             | Self-managed Dapr               |

---

## 8. Observability

### 8.1 Distributed Tracing

#### 8.1.1 Correlation ID Propagation

Every request and event must carry a correlation ID for end-to-end tracing:

**Request Flow:**

1. API Gateway/BFF generates `X-Correlation-ID` header (UUID v4)
2. User Service extracts header on incoming requests
3. All downstream calls and events include correlation ID
4. All log entries include correlation ID in structured metadata

#### 8.1.2 Trace Context Headers

| Header             | Description            | Example                            |
| ------------------ | ---------------------- | ---------------------------------- |
| `X-Correlation-ID` | Request correlation ID | `req-abc-123-def-456`              |
| `X-Trace-ID`       | Distributed trace ID   | `0af7651916cd43dd8448eb211c80319c` |
| `X-Span-ID`        | Current span ID        | `b7ad6b7169203331`                 |

---

### 8.2 Structured Logging

#### 8.2.1 Log Format

All logs use JSON structured format via Winston:

```json
{
  "timestamp": "2025-10-24T10:30:00.123Z",
  "level": "info",
  "service": "user-service",
  "environment": "production",
  "correlationId": "req-abc-123",
  "traceId": "0af7651916cd43dd8448eb211c80319c",
  "message": "User created successfully",
  "metadata": {
    "userId": "507f1f77bcf86cd799439011",
    "email": "john.doe@example.com",
    "operation": "create_user"
  }
}
```

#### 8.2.2 Required Log Events

| Event             | Level   | When                      | Required Fields           |
| ----------------- | ------- | ------------------------- | ------------------------- |
| `user.created`    | INFO    | New user registration     | `userId`, `email`         |
| `user.updated`    | INFO    | Profile updated           | `userId`, `updatedFields` |
| `user.deleted`    | INFO    | Account deleted           | `userId`, `deletedBy`     |
| `event.published` | DEBUG   | Event sent to broker      | `eventType`, `eventId`    |
| `auth.failed`     | WARNING | Authentication failure    | `reason`, `ipAddress`     |
| `db.error`        | ERROR   | Database operation failed | `operation`, `error`      |

---

### 8.3 Metrics & Alerting

#### 8.3.1 Business Metrics

| Metric Name             | Type    | Labels       | Description      |
| ----------------------- | ------- | ------------ | ---------------- |
| `users_total`           | Gauge   | `status`     | Total user count |
| `users_created_total`   | Counter | -            | Users created    |
| `users_deleted_total`   | Counter | -            | Users deleted    |
| `user_events_published` | Counter | `event_type` | Events published |

#### 8.3.2 Technical Metrics

| Metric Name                | Type      | Labels                     | Description         |
| -------------------------- | --------- | -------------------------- | ------------------- |
| `http_requests_total`      | Counter   | `method`, `path`, `status` | HTTP requests count |
| `http_request_duration_ms` | Histogram | `method`, `path`           | Request latency     |
| `db_query_duration_ms`     | Histogram | `operation`                | DB query latency    |

---

## 9. Error Handling

### 9.1 Error Response Format

All API errors return a consistent structure:

```json
{
  "success": false,
  "message": "User not found",
  "errorCode": "USER_NOT_FOUND",
  "correlationId": "req-abc-123-def-456"
}
```

**Error Categories:**

| HTTP Status | Category       | Retryable |
| ----------- | -------------- | --------- |
| 400         | Client Error   | No        |
| 401         | Authentication | No        |
| 403         | Authorization  | No        |
| 404         | Not Found      | No        |
| 409         | Conflict       | No        |
| 500         | Server Error   | Yes       |
| 503         | Unavailable    | Yes       |

---

## 10. Security

### 10.1 Authentication

The User Service uses a **layered authentication model** designed for deployment flexibility across different environments (App Service, Container Apps, AKS).

#### 10.1.1 Authentication Types

| Auth Type     | Purpose                          | Used By                |
| ------------- | -------------------------------- | ---------------------- |
| None          | Public endpoints (health checks) | Monitoring systems     |
| Service Token | Service-to-service communication | Auth, Order, Admin Svc |
| User JWT      | Customer user operations         | Customer UI via BFF    |
| Admin JWT     | Admin user operations            | Admin UI via Admin Svc |

#### 10.1.2 Layered Security Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Incoming Request                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Network Security (Optional)                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Dapr mTLS (when Dapr sidecar available)             │   │
│  │  • Automatic service identity                        │   │
│  │  • Encrypted service-to-service communication        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Service Token Validation (Required for M2M)       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Pre-shared token validation                         │   │
│  │  • Required for service-to-service calls             │   │
│  │  • Works on all deployment targets                   │   │
│  │  • Defense in depth                                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Application Auth (Required for User/Admin)        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  JWT from auth-service                               │   │
│  │  • Required for user profile operations              │   │
│  │  • Required for admin operations (role: admin)       │   │
│  │  • Contains user claims (sub, email, roles)          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### 10.1.3 Service Token Authentication

Service tokens are pre-shared secrets used for service-to-service authentication. This approach ensures the User Service works consistently across all deployment targets.

**Design Principles:**

- **Deployment Flexibility**: Works on App Service (no Dapr), Container Apps, and AKS
- **Defense in Depth**: Additional security layer even when Dapr mTLS is available
- **Simplicity**: No token refresh logic required; tokens are long-lived secrets
- **Consistency**: Same authentication pattern across all environments

**Token Format Convention:**

`svc-{service-name}-{random-24-chars}`

Example: `svc-auth-service-a1b2c3d4e5f6g7h8i9j0k1l2`

**Required Headers:**

| Header             | Value                    | Purpose             |
| ------------------ | ------------------------ | ------------------- |
| `X-Service-Token`  | Pre-shared service token | Authentication      |
| `X-Correlation-ID` | Request correlation ID   | Distributed tracing |
| `X-Service-Name`   | Calling service name     | Audit logging       |
| `Content-Type`     | `application/json`       | Request body format |

**Validation Flow:**

```
┌─────────────────┐    Request with    ┌─────────────────────┐
│  Auth Service   │ ────────────────►  │    User Service     │
│                 │   Authorization:   │                     │
│                 │   Bearer svc-...   │                     │
└─────────────────┘   X-Service-Name:  └─────────────────────┘
                      auth-service               │
                                                 ▼
                                    ┌───────────────────────┐
                                    │ 1. Extract token      │
                                    │ 2. Lookup service     │
                                    │ 3. Get expected token │
                                    │ 4. Compare tokens     │
                                    │ 5. Allow/Deny         │
                                    └───────────────────────┘
```

**Deployment Target Compatibility:**

| Deployment Target      | Dapr mTLS | Service Token | Notes                                |
| ---------------------- | --------- | ------------- | ------------------------------------ |
| Azure App Service      | ❌ No     | ✅ Required   | No Dapr support                      |
| Azure Container Apps   | ✅ Yes    | ✅ Required   | Dapr + token for defense in depth    |
| Azure Kubernetes (AKS) | ✅ Yes    | ✅ Required   | Dapr + token for defense in depth    |
| Local Development      | Optional  | ✅ Required   | Can run with or without Dapr sidecar |

#### 10.1.4 User JWT Authentication

User endpoints require a valid JWT token issued by the auth-service.

```
Authorization: Bearer <user_jwt_token>
```

**Token Validation Process:**

1. Extract token from `Authorization: Bearer <token>` header
2. Validate token signature using `JWT_SECRET` or `JWT_PUBLIC_KEY`
3. Verify token is not expired (`exp` claim)
4. Extract user claims (`sub`, `email`, `roles`)
5. Attach user context to request for authorization checks

**Required JWT Claims:**

| Claim   | Description          | Required |
| ------- | -------------------- | -------- |
| `sub`   | User ID              | Yes      |
| `email` | User email           | Yes      |
| `roles` | User roles array     | Yes      |
| `exp`   | Expiration timestamp | Yes      |
| `iat`   | Issued at timestamp  | Yes      |

#### 10.1.5 Admin JWT Authentication

Admin endpoints require a valid JWT token issued by the auth-service with `role: admin`.

```
Authorization: Bearer <admin_jwt_token>
```

**Additional Validation:**

- Verify `roles` array contains `admin`
- All admin operations are logged for audit trail

### 10.2 Authorization

Authorization determines **what** an authenticated entity can do. After authentication validates identity, authorization checks permissions.

#### 10.2.1 Authorization Rules

| Auth Type     | Authorized Operations                                        |
| ------------- | ------------------------------------------------------------ |
| None          | Health endpoints (`/health`, `/health/ready`) and `/metrics` |
| Service Token | User lookup by email, user profile queries                   |
| User JWT      | Own profile CRUD, addresses, payments, wishlist, preferences |
| Admin JWT     | All user operations, list users, deactivate/delete users     |
| Dapr Internal | Event subscription endpoints only                            |

#### 10.2.2 Role-Based Access Control

| Role     | Permissions                                     |
| -------- | ----------------------------------------------- |
| customer | Own profile CRUD, addresses, payments, wishlist |
| admin    | All customer permissions + all user management  |

#### 10.2.3 Endpoint Authorization Matrix

| Endpoint Pattern     | Required Auth | Additional Rules   |
| -------------------- | ------------- | ------------------ |
| `GET /health/*`      | None          | Public             |
| `GET /users/:id`     | User JWT      | Own profile only   |
| `PATCH /users/:id`   | User JWT      | Own profile only   |
| `DELETE /users/:id`  | User JWT      | Own profile only   |
| `/users/addresses/*` | User JWT      | Own addresses only |
| `/users/payments/*`  | User JWT      | Own payments only  |
| `/users/wishlist/*`  | User JWT      | Own wishlist only  |
| `GET /internal/*`    | Service Token | M2M communication  |
| `/admin/*`           | Admin JWT     | All users          |

### 10.3 Service-to-Service Communication

This section describes how other services call User Service APIs.

#### 10.3.1 Direct HTTP with Service Token

For deployments without Dapr (e.g., Azure App Service), calling services make direct HTTP requests with:

| Header             | Value                    | Purpose             |
| ------------------ | ------------------------ | ------------------- |
| `X-Service-Token`  | Pre-shared service token | Authentication      |
| `X-Correlation-ID` | Request correlation ID   | Distributed tracing |
| `X-Service-Name`   | Calling service name     | Audit logging       |
| `Content-Type`     | `application/json`       | Request body format |

**Example: Auth Service calling User Service**

```javascript
// Auth Service looking up user by email
const response = await fetch(`${USER_SERVICE_URL}/api/internal/users/email/${email}`, {
  method: 'GET',
  headers: {
    'X-Service-Token': process.env.SERVICE_USER_TOKEN,
    'X-Correlation-ID': correlationId,
    'X-Service-Name': 'auth-service',
    'Content-Type': 'application/json',
  },
});
```

#### 10.3.2 Dapr Service Invocation with Service Token

For deployments with Dapr (Container Apps, AKS), use Dapr for service discovery while still including service token for defense in depth.

```javascript
// Using Dapr service invocation
const response = await daprClient.invoker.invoke(
  'user-service',
  'api/internal/users/email/' + email,
  HttpMethod.GET,
  undefined,
  {
    'X-Service-Token': process.env.SERVICE_USER_TOKEN,
    'X-Correlation-ID': correlationId,
    'X-Service-Name': 'auth-service',
  },
);
```

#### 10.3.3 Why Service Token with Dapr?

Even when using Dapr's mTLS, we include service tokens for:

1. **Defense in Depth**: Multiple layers of security validation
2. **Caller Identification**: Know which specific service made the call
3. **Deployment Flexibility**: Same code works with or without Dapr
4. **Audit Trail**: Service name logged for all requests
5. **Consistency**: Uniform authentication pattern across all deployments

### 10.4 Input Validation

All input is validated using custom validators before processing:

| Field         | Validation Rules                       |
| ------------- | -------------------------------------- |
| `email`       | RFC 5322 format, max 255 chars, unique |
| `password`    | Min 6 chars, max 100 chars             |
| `firstName`   | Max 50 chars, letters only             |
| `lastName`    | Max 50 chars, letters only             |
| `phoneNumber` | E.164 format, max 20 chars             |

### 10.5 CORS Configuration

Cross-Origin Resource Sharing is configured via the `CORS_ORIGINS` environment variable for frontend access.

**Allowed Origins (Development):**

- `http://localhost:3000` (Customer UI)
- `http://localhost:3001` (Admin UI)

---

## Document History

| Version | Date       | Author | Changes                                 |
| ------- | ---------- | ------ | --------------------------------------- |
| 1.1     | 2025-01-24 | Team   | Added service token auth, layered model |
| 1.0     | 2025-01-24 | Team   | Initial architecture                    |
