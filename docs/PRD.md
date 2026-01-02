# Product Requirements Document (PRD)

## User Service - xShop.ai Platform

**Version:** 1.0  
**Last Updated:** October 24, 2025  
**Status:** Active Development  
**Owner:** xShop.ai Platform Team

---

## Table of Contents

1. [Product Overview](#1-product-overview)
   - 1.1 [Product Vision](#11-product-vision)
   - 1.2 [Business Objectives](#12-business-objectives)
   - 1.3 [Success Metrics](#13-success-metrics)
   - 1.4 [Product Description](#14-product-description)
   - 1.5 [Target Users](#15-target-users)
   - 1.6 [Key Features](#16-key-features)
2. [Technical Architecture](#2-technical-architecture)
   - 2.1 [Technology Stack](#21-technology-stack)
   - 2.2 [Architecture Pattern](#22-architecture-pattern)
   - 2.3 [Data Model](#23-data-model)
   - 2.4 [Event Schema](#24-event-schema)
   - 2.5 [Database Indexes](#25-database-indexes)
3. [API Specifications](#3-api-specifications)
   - 3.1 [Authentication](#31-authentication)
   - 3.2 [User Management APIs](#32-user-management-apis)
   - 3.3 [Address Management APIs](#33-address-management-apis)
   - 3.4 [Payment Method APIs](#34-payment-method-apis)
   - 3.5 [Wishlist APIs](#35-wishlist-apis)
   - 3.6 [Preference APIs](#36-preference-apis)
   - 3.7 [Admin APIs](#37-admin-apis)
   - 3.8 [Health Check APIs](#38-health-check-apis)
4. [Functional Requirements](#4-functional-requirements)
   - 4.1 [User Registration](#41-user-registration)
   - 4.2 [Profile Management](#42-profile-management)
   - 4.3 [Address Management](#43-address-management)
   - 4.4 [Payment Method Management](#44-payment-method-management)
   - 4.5 [Wishlist Management](#45-wishlist-management)
   - 4.6 [Preference Management](#46-preference-management)
   - 4.7 [Account Status Management](#47-account-status-management)
   - 4.8 [Admin Operations](#48-admin-operations)
5. [Non-Functional Requirements](#5-non-functional-requirements)
   - 5.1 [Performance](#51-performance)
   - 5.2 [Scalability](#52-scalability)
   - 5.3 [Availability](#53-availability)
   - 5.4 [Security](#54-security)
   - 5.5 [Data Privacy](#55-data-privacy)
   - 5.6 [Observability](#56-observability)
   - 5.7 [Error Handling](#57-error-handling)
6. [Dependencies](#6-dependencies)
   - 6.1 [External Services](#61-external-services)
   - 6.2 [Infrastructure](#62-infrastructure)
   - 6.3 [Development Dependencies](#63-development-dependencies)
7. [Testing Strategy](#7-testing-strategy)
   - 7.1 [Unit Testing](#71-unit-testing)
   - 7.2 [Integration Testing](#72-integration-testing)
   - 7.3 [E2E Testing](#73-e2e-testing)
   - 7.4 [Performance Testing](#74-performance-testing)
   - 7.5 [Security Testing](#75-security-testing)
8. [Deployment](#8-deployment)
   - 8.1 [Environment Configuration](#81-environment-configuration)
   - 8.2 [Docker Configuration](#82-docker-configuration)
   - 8.3 [Kubernetes Deployment](#83-kubernetes-deployment)
   - 8.4 [CI/CD Pipeline](#84-cicd-pipeline)
9. [Monitoring & Alerts](#9-monitoring--alerts)
   - 9.1 [Metrics](#91-metrics)
   - 9.2 [Alerts](#92-alerts)
   - 9.3 [Dashboards](#93-dashboards)
10. [Risks & Mitigations](#10-risks--mitigations)
11. [Compliance & Legal](#11-compliance--legal)
    - 11.1 [GDPR Compliance](#111-gdpr-compliance)
    - 11.2 [PCI-DSS Compliance (Payment Methods)](#112-pci-dss-compliance-payment-methods)
    - 11.3 [Data Privacy](#113-data-privacy)
12. [Documentation References](#12-documentation-references)
    - 12.1 [Developer Documentation](#121-developer-documentation)
    - 12.2 [Runbooks](#122-runbooks)
    - 12.3 [API Documentation](#123-api-documentation)
13. [Approval & Sign-off](#13-approval--sign-off)
14. [Revision History](#14-revision-history)
15. [Appendix](#15-appendix)
    - 15.1 [Glossary](#151-glossary)
    - 15.2 [References](#152-references)

---

## 1. Product Overview

### 1.1 Product Vision

The User Service is a core microservice within the xShop.ai e-commerce platform, responsible for managing all user-related data, profiles, and account lifecycle operations. It serves as the central repository for user information and provides RESTful APIs for user registration, profile management, and administrative operations.

### 1.2 Business Objectives

- **Centralized User Management**: Single source of truth for all user data across the platform
- **Scalability**: Support millions of users with sub-100ms response times
- **Security & Privacy**: GDPR-compliant user data management with encryption and audit trails
- **Self-Service**: Enable users to manage their profiles, addresses, payment methods, and preferences
- **Admin Capabilities**: Provide administrative tools for user support and management

### 1.3 Success Metrics

| Metric                         | Target  | Current |
| ------------------------------ | ------- | ------- |
| API Response Time (p95)        | < 100ms | TBD     |
| Service Uptime                 | 99.9%   | TBD     |
| User Registration Success Rate | > 98%   | TBD     |
| Profile Update Success Rate    | > 99%   | TBD     |
| API Error Rate                 | < 0.5%  | TBD     |

### 1.4 Product Description

The User Service is a Node.js/Express microservice that manages user accounts, profiles, addresses, payment methods, wishlists, and preferences. It follows the **Pure Publisher** pattern, publishing events via Dapr Pub/Sub (with RabbitMQ backend) for decoupled communication with other microservices.

### 1.5 Target Users

1. **Customers**: End-users creating accounts and managing their profiles
2. **Admin Users**: Platform administrators managing user accounts and support operations
3. **Internal Services**: Other microservices (auth, order, notification) consuming user data

### 1.6 Key Features

- ✅ User profile management (CRUD operations)
- ✅ Address management (multiple shipping/billing addresses)
- ✅ Payment method management (credit cards, digital wallets)
- ✅ Wishlist management
- ✅ User preferences (notifications, privacy settings)
- ✅ Role-based access control (customer, admin)
- ✅ Account activation/deactivation
- ✅ Event-driven architecture with message broker integration
- ✅ Comprehensive health checks and observability

---

## 2. Technical Architecture

### 3.1 Technology Stack

- **Runtime**: Node.js v16+
- **Framework**: Express v5.1.0
- **Database**: MongoDB v8.18.0 (Mongoose ODM)
- **Authentication**: JWT (validated by auth-service)
- **Observability**: Winston (logging), OpenTelemetry (tracing)
- **Testing**: Jest, Supertest
- **Validation**: Custom validators

### 3.2 Architecture Pattern

**Pure Publisher (AWS EventBridge Style)**

```
┌─────────────────┐
│  User Service   │
└────────┬────────┘
         │ HTTP POST
         ▼
┌──────────────────────┐
│ Message Broker       │
│ Service (Gateway)    │
└──────────┬───────────┘
           │ AMQP/Kafka
           ▼
┌──────────────────────┐
│ RabbitMQ / Kafka /   │
│ Azure Service Bus    │
└──────────────────────┘
```

### 3.3 Data Model

#### User Schema

```javascript
{
  email: String (required, unique),
  password: String (hashed, bcrypt),
  firstName: String,
  lastName: String,
  phoneNumber: String,
  roles: [String] (enum: ['customer', 'admin']),

  isEmailVerified: Boolean (default: false),
  isActive: Boolean (default: true),

  addresses: [AddressSchema],
  paymentMethods: [PaymentSchema],
  wishlist: [WishlistSchema],
  preferences: PreferencesSchema,

  createdBy: String (default: 'SELF_REGISTRATION'),
  updatedBy: String,

  timestamps: { createdAt, updatedAt }
}
```

#### Address Schema

```javascript
{
  type: String (enum: ['shipping', 'billing']),
  isDefault: Boolean,
  fullName: String,
  addressLine1: String,
  addressLine2: String,
  city: String,
  state: String,
  postalCode: String,
  country: String,
  phoneNumber: String
}
```

#### Payment Method Schema

```javascript
{
  type: String (enum: ['credit_card', 'debit_card', 'paypal']),
  isDefault: Boolean,
  cardholderName: String,
  cardLastFour: String,
  expiryMonth: Number,
  expiryYear: Number,
  billingAddress: AddressSchema
}
```

#### Wishlist Schema

```javascript
{
  productId: String (required),
  addedAt: Date (default: Date.now),
  notes: String
}
```

#### Preferences Schema

```javascript
{
  emailNotifications: Boolean (default: true),
  smsNotifications: Boolean (default: false),
  marketingEmails: Boolean (default: true),
  language: String (default: 'en'),
  currency: String (default: 'USD'),
  theme: String (enum: ['light', 'dark'], default: 'light')
}
```

### 3.4 Event Publishing

The service publishes the following events via Dapr Pub/Sub:

| Event Type         | Trigger              | Payload                                  |
| ------------------ | -------------------- | ---------------------------------------- |
| `user.created`     | User registration    | `{ userId, email, firstName, lastName }` |
| `user.updated`     | Profile update       | `{ userId, updates }`                    |
| `user.deleted`     | Account deletion     | `{ userId, email }`                      |
| `user.deactivated` | Account deactivation | `{ userId, reason }`                     |
| `user.reactivated` | Account reactivation | `{ userId }`                             |

**Event Format (AWS EventBridge Style)**:

```javascript
{
  source: 'user-service',
  eventType: 'user.created',
  eventVersion: '1.0',
  eventId: 'evt-123-xyz',
  timestamp: '2025-10-24T10:30:00Z',
  correlationId: 'corr-abc-def',
  data: { userId, email, firstName, lastName },
  metadata: { ipAddress, userAgent }
}
```

---

## 4. API Specifications

### 4.1 Base URL

- **Local Development**: `http://localhost:1002`
- **Production**: `https://api.xshop.ai/user-service`

### 4.2 API Endpoints

#### 4.2.1 Operational Endpoints

| Method | Endpoint        | Description          | Auth Required |
| ------ | --------------- | -------------------- | ------------- |
| `GET`  | `/health`       | Service health check | No            |
| `GET`  | `/health/ready` | Readiness probe      | No            |
| `GET`  | `/health/live`  | Liveness probe       | No            |
| `GET`  | `/metrics`      | Prometheus metrics   | No            |
| `GET`  | `/`             | Welcome message      | No            |
| `GET`  | `/version`      | Service version      | No            |

#### 4.2.2 User Profile Endpoints

| Method   | Endpoint             | Description                    | Auth Required |
| -------- | -------------------- | ------------------------------ | ------------- |
| `POST`   | `/users`             | Create new user                | No            |
| `GET`    | `/users/findByEmail` | Find user by email             | No            |
| `GET`    | `/users`             | Get authenticated user profile | Yes           |
| `PATCH`  | `/users`             | Update user profile            | Yes           |
| `DELETE` | `/users`             | Delete user account            | Yes           |

#### 4.2.3 Address Management Endpoints

| Method   | Endpoint                      | Description       | Auth Required |
| -------- | ----------------------------- | ----------------- | ------------- |
| `GET`    | `/users/addresses`            | Get all addresses | Yes           |
| `POST`   | `/users/addresses`            | Add new address   | Yes           |
| `PATCH`  | `/users/addresses/:addressId` | Update address    | Yes           |
| `DELETE` | `/users/addresses/:addressId` | Remove address    | Yes           |

#### 4.2.4 Payment Method Endpoints

| Method   | Endpoint                           | Description             | Auth Required |
| -------- | ---------------------------------- | ----------------------- | ------------- |
| `GET`    | `/users/paymentmethods`            | Get all payment methods | Yes           |
| `POST`   | `/users/paymentmethods`            | Add payment method      | Yes           |
| `PATCH`  | `/users/paymentmethods/:paymentId` | Update payment method   | Yes           |
| `DELETE` | `/users/paymentmethods/:paymentId` | Remove payment method   | Yes           |

#### 4.2.5 Wishlist Endpoints

| Method   | Endpoint                      | Description          | Auth Required |
| -------- | ----------------------------- | -------------------- | ------------- |
| `GET`    | `/users/wishlist`             | Get wishlist         | Yes           |
| `POST`   | `/users/wishlist`             | Add item to wishlist | Yes           |
| `PATCH`  | `/users/wishlist/:wishlistId` | Update wishlist item | Yes           |
| `DELETE` | `/users/wishlist/:wishlistId` | Remove from wishlist | Yes           |

#### 4.2.6 Admin Endpoints

| Method   | Endpoint                   | Description                   | Auth Required |
| -------- | -------------------------- | ----------------------------- | ------------- |
| `GET`    | `/admin/users`             | List all users (paginated)    | Admin         |
| `GET`    | `/admin/users/stats`       | Get user statistics           | Admin         |
| `GET`    | `/admin/users/list/recent` | Get recently registered users | Admin         |
| `GET`    | `/admin/users/:id`         | Get user by ID                | Admin         |
| `PATCH`  | `/admin/users/:id`         | Update user (admin)           | Admin         |
| `DELETE` | `/admin/users/:id`         | Delete user (admin)           | Admin         |

### 4.3 Request/Response Examples

#### Create User (POST /users)

**Request:**

```json
{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1-555-0123"
}
```

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

#### Get User Profile (GET /users)

**Request Headers:**

```
Authorization: Bearer <jwt-token>
X-Correlation-ID: corr-123-abc
```

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
      "currency": "USD"
    },
    "createdAt": "2025-10-24T10:30:00Z",
    "updatedAt": "2025-10-24T10:30:00Z"
  }
}
```

#### Update Profile (PATCH /users)

**Request:**

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
    "preferences": {
      "emailNotifications": false,
      "theme": "dark"
    },
    "updatedAt": "2025-10-24T11:00:00Z"
  }
}
```

#### Add Address (POST /users/addresses)

**Request:**

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
    "addressLine1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postalCode": "10001",
    "country": "USA"
  }
}
```

### 4.4 Error Responses

All errors follow a standardized format:

**400 Bad Request:**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ],
  "correlationId": "corr-123-abc"
}
```

**401 Unauthorized:**

```json
{
  "success": false,
  "message": "Authentication required",
  "correlationId": "corr-123-abc"
}
```

**404 Not Found:**

```json
{
  "success": false,
  "message": "User not found",
  "correlationId": "corr-123-abc"
}
```

**500 Internal Server Error:**

```json
{
  "success": false,
  "message": "Internal server error",
  "correlationId": "corr-123-abc"
}
```

---

## 5. Functional Requirements

### REQ-1: User Registration & Authentication

#### REQ-1.1 User Registration (FR-001)

**Priority:** P0 (Critical)  
**Description:** Users can create accounts with email and password.

**Acceptance Criteria:**

- ✅ Email must be unique across the system
- ✅ Password must be at least 6 characters (recommended 8+)
- ✅ Password is hashed using bcrypt (cost factor: 12)
- ✅ Default role is 'customer'
- ✅ `user.created` event published to message broker
- ✅ Returns 201 Created with user data (excluding password)
- ✅ Correlation ID propagated for distributed tracing
- ✅ Account created with isActive: true, isEmailVerified: false
- ✅ createdBy field set to 'SELF_REGISTRATION'

**Validation Rules:**

- **Email**: Valid RFC 5322 format, unique, max 255 characters, case-insensitive
- **Password**: 6-100 characters, no specific complexity requirements (UX consideration)
- **First Name**: Optional, max 50 characters, letters only
- **Last Name**: Optional, max 50 characters, letters only
- **Phone Number**: Optional, E.164 format, max 20 characters

**Error Cases:**

- Email already exists → 409 Conflict, errorCode: EMAIL_EXISTS
- Invalid email format → 400 Bad Request, errorCode: INVALID_EMAIL
- Password too short → 400 Bad Request, errorCode: PASSWORD_TOO_SHORT
- Message broker unavailable → Log warning, continue (graceful degradation)

#### REQ-1.2 Profile Retrieval (FR-002)

**Priority:** P0 (Critical)  
**Description:** Users can view their own profile data.

**Acceptance Criteria:**

- ✅ Authenticated users can GET /users endpoint
- ✅ Returns full profile including: basic info, addresses, payment methods (masked), wishlist, preferences
- ✅ Password field excluded from response (security)
- ✅ Correlation ID included in logs
- ✅ Response time < 100ms (p95)

**Security:**

- Requires valid JWT token
- Users can only access their own profile
- Admins can access any profile via /admin/users/:id

**Error Cases:**

- No JWT token → 401 Unauthorized
- Invalid/expired JWT → 401 Unauthorized
- User not found → 404 Not Found

### REQ-2: Profile Management

#### REQ-2.1 Profile Update (FR-003)

**Priority:** P0 (Critical)  
**Description:** Users can update their profile information.

**Acceptance Criteria:**

- ✅ Authenticated users can update: firstName, lastName, phoneNumber, preferences
- ✅ Email cannot be changed via this endpoint (separate verification flow)
- ✅ Password change handled by auth-service (not user-service)
- ✅ `user.updated` event published on successful update
- ✅ Returns updated user data with updatedAt timestamp
- ✅ updatedBy field populated with user ID
- ✅ Partial updates supported (PATCH semantics)

**Validation:**

- Only allow updates to whitelisted fields
- Validate format of phoneNumber if provided
- Validate preferences enum values

**Error Cases:**

- Attempt to update email → 400 Bad Request, errorCode: FIELD_NOT_UPDATABLE
- Invalid phone format → 400 Bad Request, errorCode: INVALID_PHONE
- Message broker failure → Log warning, continue (graceful degradation)

### REQ-3: Address Management

#### REQ-3.1 Add Address (FR-004)

**Priority:** P1 (High)  
**Description:** Users can add shipping and billing addresses.

**Acceptance Criteria:**

- ✅ Users can add multiple addresses (no limit)
- ✅ Each address has type: 'shipping' or 'billing'
- ✅ One address can be marked as default per type
- ✅ When setting new default, previous default for that type is unmarked
- ✅ Address stored as embedded document in user collection
- ✅ Returns 200 OK with address object including generated addressId
- ✅ Validates all required fields before saving

**Validation Rules:**

- **Type**: Required, enum ['shipping', 'billing']
- **Full Name**: Required, 1-100 characters, letters/spaces only
- **Address Line 1**: Required, 1-200 characters
- **Address Line 2**: Optional, max 200 characters
- **City**: Required, 1-100 characters, letters/spaces only
- **State/Province**: Required, max 100 characters
- **Postal Code**: Required, max 20 characters, alphanumeric+dash
- **Country**: Required, max 100 characters
- **Phone Number**: Optional, E.164 format

**Error Cases:**

- Missing required field → 400 Bad Request, errorCode: MISSING_FIELD
- Invalid field format → 400 Bad Request, errorCode: INVALID_FORMAT
- User not found → 404 Not Found

#### REQ-3.2 Update Address (FR-005)

**Priority:** P1 (High)  
**Description:** Users can update existing addresses.

**Acceptance Criteria:**

- ✅ Users can update any field of their addresses
- ✅ Address identified by addressId
- ✅ Partial updates supported
- ✅ Returns updated address object
- ✅ Validates updated fields

**Error Cases:**

- Address not found → 404 Not Found, errorCode: ADDRESS_NOT_FOUND
- Invalid address ID format → 400 Bad Request

#### REQ-3.3 Delete Address (FR-006)

**Priority:** P1 (High)  
**Description:** Users can remove addresses.

**Acceptance Criteria:**

- ✅ Address removed from user's addresses array
- ✅ Returns 200 OK with success message
- ✅ If default address deleted, no new default set automatically

**Error Cases:**

- Address not found → 404 Not Found, errorCode: ADDRESS_NOT_FOUND

#### REQ-3.4 List Addresses (FR-007)

**Priority:** P1 (High)  
**Description:** Users can retrieve all their addresses.

**Acceptance Criteria:**

- ✅ Returns array of all user addresses
- ✅ Includes addressId, type, isDefault flag
- ✅ Empty array if no addresses

### REQ-4: Payment Method Management

**Priority:** P1 (High)  
**Description:** Users can manage payment methods for checkout.

**Acceptance Criteria:**

- ✅ Users can add credit/debit cards, PayPal
- ✅ Card numbers stored as last 4 digits only (tokenization via payment gateway)
- ✅ One payment method can be marked as default
- ✅ Users can update/remove payment methods
- ✅ PCI-DSS compliance (no full card storage)

**Security Requirements:**

- Only last 4 digits stored
- Full card data sent directly to payment gateway
- Payment tokens stored securely
- Card CVV never stored

### 5.5 Wishlist Management (FR-005)

**Priority:** P2 (Medium)  
**Description:** Users can save products to wishlist for later purchase.

**Acceptance Criteria:**

- ✅ Users can add products to wishlist
- ✅ Store product ID, timestamp, optional notes
- ✅ Users can view, update, remove wishlist items
- ✅ Duplicate products prevented
- ✅ Returns wishlist with product details

### 5.6 User Preferences (FR-006)

**Priority:** P2 (Medium)  
**Description:** Users can customize notification and display preferences.

**Acceptance Criteria:**

- ✅ Notification preferences (email, SMS, marketing)
- ✅ Language preference
- ✅ Currency preference
- ✅ Theme preference (light/dark)
- ✅ Preferences saved with user profile
- ✅ Default values applied on registration

### 5.7 Account Deactivation (FR-007)

**Priority:** P1 (High)  
**Description:** Users can deactivate their accounts.

**Acceptance Criteria:**

- ✅ Users can self-service deactivate account
- ✅ Deactivated accounts cannot log in
- ✅ Data retained for compliance (30 days)
- ✅ `user.deactivated` event published
- ✅ Reactivation possible within 30 days

### 5.8 Account Deletion (FR-008)

**Priority:** P1 (High)  
**Description:** Users can permanently delete their accounts.

**Acceptance Criteria:**

- ✅ Users can self-service delete account
- ✅ Confirmation required (password verification)
- ✅ Data removed per GDPR/privacy laws
- ✅ `user.deleted` event published
- ✅ Cascade deletion handled by consuming services
- ✅ 30-day grace period before permanent deletion

### 5.9 Admin User Management (FR-009)

**Priority:** P1 (High)  
**Description:** Admins can manage all user accounts.

**Acceptance Criteria:**

- ✅ Admins can list all users (paginated)
- ✅ Admins can view user statistics
- ✅ Admins can view recent registrations
- ✅ Admins can update any user profile
- ✅ Admins can deactivate/delete accounts
- ✅ Audit trail for admin actions

**Admin Statistics:**

- Total users
- Active users
- Deactivated users
- New registrations (last 7/30 days)
- User growth trends

---

## 6. Non-Functional Requirements

### 6.1 Performance (NFR-001)

**Priority:** P0 (Critical)

| Metric                  | Requirement              |
| ----------------------- | ------------------------ |
| API Response Time (p50) | < 50ms                   |
| API Response Time (p95) | < 100ms                  |
| API Response Time (p99) | < 200ms                  |
| Throughput              | 1000 req/s per instance  |
| Database Query Time     | < 50ms (indexed queries) |

### 6.2 Scalability (NFR-002)

**Priority:** P0 (Critical)

- Horizontal scaling via multiple instances
- Stateless service design
- Database connection pooling (max 100 connections)
- Support 10M+ users
- Handle 10K concurrent requests

### 6.3 Availability (NFR-003)

**Priority:** P0 (Critical)

- **Uptime**: 99.9% (8.76 hours downtime/year)
- **Recovery Time Objective (RTO)**: < 5 minutes
- **Recovery Point Objective (RPO)**: < 1 minute
- Health checks every 10 seconds
- Auto-restart on failure

### 6.4 Security (NFR-004)

**Priority:** P0 (Critical)

- **Authentication**: JWT validation (auth-service integration)
- **Authorization**: Role-based access control (RBAC)
- **Encryption**: Passwords hashed with bcrypt (cost: 12)
- **Data Privacy**: GDPR/CCPA compliance
- **API Security**: Rate limiting (100 req/min per IP)
- **HTTPS Only**: TLS 1.3 in production
- **Input Validation**: All endpoints validated
- **SQL Injection Prevention**: Mongoose ODM
- **XSS Prevention**: Input sanitization

### 6.5 Observability (NFR-005)

**Priority:** P1 (High)

**Logging:**

- Structured JSON logs (Winston)
- Log levels: ERROR, WARN, INFO, DEBUG
- Correlation ID in all logs
- PII redaction (passwords, tokens)
- Log retention: 30 days

**Tracing:**

- OpenTelemetry instrumentation
- Distributed tracing across services
- Trace sampling: 100% (development), 10% (production)

**Metrics:**

- Prometheus-compatible `/metrics` endpoint
- Request count, duration, error rate
- Database connection pool metrics
- Memory/CPU usage

**Health Checks:**

- `/health`: Overall service health
- `/health/ready`: Kubernetes readiness probe
- `/health/live`: Kubernetes liveness probe

### 6.6 Reliability (NFR-006)

**Priority:** P1 (High)

- **Error Handling**: Centralized error middleware
- **Retry Logic**: Message broker publishing (3 retries, exponential backoff)
- **Graceful Degradation**: Continue operation if message broker unavailable
- **Circuit Breaker**: 5 failures → open circuit for 30 seconds
- **Timeout**: API calls timeout after 5 seconds
- **Database Failover**: MongoDB replica set support

### 6.7 Maintainability (NFR-007)

**Priority:** P2 (Medium)

- **Code Quality**: ESLint, 80%+ code coverage
- **Documentation**: JSDoc comments, README, API specs
- **Testing**: Unit, integration, E2E tests
- **Versioning**: Semantic versioning (SemVer)
- **CI/CD**: Automated build, test, deploy
- **Monitoring**: Grafana dashboards, PagerDuty alerts

---

## 7. Dependencies

### 7.1 Internal Service Dependencies

| Service        | Purpose                      | Communication         | Critical |
| -------------- | ---------------------------- | --------------------- | -------- |
| Dapr (Sidecar) | Event publishing via Pub/Sub | Dapr SDK (@dapr/dapr) | Yes      |

### 7.2 External Service Dependencies

| Service | Purpose | Communication | Critical |
| ------- | ------- | ------------- | -------- |
| None    | -       | -             | -        |

**Note:** User-service has no external third-party service dependencies. All integrations are with internal xShop.ai platform services.

### 7.3 Infrastructure Dependencies

| Component | Purpose                         | Technology     | Configuration        | Critical |
| --------- | ------------------------------- | -------------- | -------------------- | -------- |
| MongoDB   | Primary database                | MongoDB 8.18.0 | Replica set, 3 nodes | Yes      |
| RabbitMQ  | Message broker backend for Dapr | RabbitMQ 3.x   | Pub/Sub component    | Yes      |

**Note:** User-service uses Dapr Pub/Sub abstraction layer with RabbitMQ as the backend message broker. The service communicates with Dapr sidecar via the @dapr/dapr SDK.

### 7.4 Service Integration Map

```
┌─────────────┐
│auth-service │────► Calls user-service for user data
└─────────────┘
       │
       ▼
┌─────────────┐
│ user-service│────► Publishes user events (user.created, user.updated, etc.)
└─────────────┘
       │
       ▼
┌──────────────────────┐
│ Dapr Pub/Sub         │────► RabbitMQ backend
└──────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│ notification-service, audit-service, auth-service, etc. │
└─────────────────────────────────────────────────────────┘
```

**Dependency Flow:**

- **auth-service → user-service**: Auth service calls `/users/findByEmail` for authentication
- **user-service → Dapr → RabbitMQ**: Publishes user lifecycle events via Dapr Pub/Sub
- **user-service → notification-service** (via events): Triggers welcome emails, notifications
- **user-service → audit-service** (via events): Logs user actions for compliance

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Coverage Target:** 80%+

**Test Cases:**

- Model validation (User, Address, Payment, Wishlist schemas)
- Password hashing middleware
- Utility functions (correlation ID, error handling)
- Validators (email, phone, postal code)

**Tools:**

- Jest
- node-mocks-http
- Supertest

### 8.2 Integration Tests

**Coverage:** API endpoints, database operations

**Test Cases:**

- User registration flow
- Profile update flow
- Address CRUD operations
- Payment method CRUD operations
- Wishlist CRUD operations
- Admin operations
- Event publishing verification

**Test Data:**

- Fixtures for users, addresses, payment methods
- Test database cleanup between tests

### 8.3 E2E Tests

**Coverage:** Complete user journeys

**Test Scenarios:**

1. User registration → profile update → add address → add payment
2. Admin user management flow
3. Account deactivation → reactivation
4. Account deletion flow
5. Wishlist management flow

### 8.4 Performance Tests

**Tools:** k6, Artillery

**Test Scenarios:**

- Load test: 1000 req/s sustained for 10 minutes
- Stress test: Ramp up to 1002 req/s
- Spike test: Sudden traffic increase
- Soak test: 500 req/s for 4 hours

**Metrics:**

- Response time (p50, p95, p99)
- Error rate
- Throughput
- Database connection pool usage

### 8.5 Security Tests

**Test Cases:**

- JWT validation
- Role-based access control
- SQL injection attempts
- XSS attempts
- Rate limiting
- Password strength enforcement
- PII redaction in logs

---

## 8. Deployment

### 8.1 Environment Configuration

| Environment | Purpose                | Database                    | Replicas |
| ----------- | ---------------------- | --------------------------- | -------- |
| Development | Local dev              | MongoDB local               | 1        |
| Staging     | Pre-production testing | MongoDB Atlas               | 2        |
| Production  | Live traffic           | MongoDB Atlas (replica set) | 3+       |

### 9.2 Environment Variables

```env
# Server
PORT=1002
NODE_ENV=production

# MongoDB
MONGODB_CONNECTION_SCHEME=mongodb+srv
MONGODB_HOST=cluster.mongodb.net
MONGODB_PORT=27017
MONGODB_USERNAME=<encrypted>
MONGODB_PASSWORD=<encrypted>
MONGODB_DB_NAME=user-service-db
MONGODB_DB_PARAMS=retryWrites=true&w=majority

# Dapr Configuration
DAPR_HOST=localhost
DAPR_HTTP_PORT=3500
PUBSUB_NAME=user-pubsub
TOPIC_NAME=user.events

# Observability
LOG_LEVEL=info
LOG_TO_CONSOLE=true
LOG_TO_FILE=false
OTEL_SERVICE_NAME=user-service
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318

# Feature Flags
FEATURE_WISHLIST_ENABLED=true
FEATURE_PREFERENCES_ENABLED=true
```

### 9.3 Docker Configuration

**Dockerfile:**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 1002
CMD ["node", "src/server.js"]
```

**Docker Compose:**

```yaml
version: '3.8'
services:
  user-service:
    build: .
    ports:
      - '1002:1002'
    environment:
      - NODE_ENV=production
      - MONGODB_HOST=mongodb
    depends_on:
      - mongodb
      - dapr-sidecar
      - rabbitmq
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:1002/health']
      interval: 10s
      timeout: 3s
      retries: 3

  dapr-sidecar:
    image: daprio/daprd:latest
    command:
      [
        './daprd',
        '-app-id',
        'user-service',
        '-app-port',
        '1002',
        '-dapr-http-port',
        '3500',
        '-components-path',
        '/components',
      ]
    depends_on:
      - rabbitmq
```

### 9.4 Kubernetes Deployment

**Deployment YAML:**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
        - name: user-service
          image: xshopai/user-service:1.0.0
          ports:
            - containerPort: 1002
          env:
            - name: NODE_ENV
              value: 'production'
            - name: MONGODB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mongodb-secret
                  key: password
          resources:
            requests:
              memory: '256Mi'
              cpu: '250m'
            limits:
              memory: '512Mi'
              cpu: '500m'
          livenessProbe:
            httpGet:
              path: /health/live
              port: 1002
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 1002
            initialDelaySeconds: 10
            periodSeconds: 5
```

### 9.5 CI/CD Pipeline

**GitHub Actions Workflow:**

```yaml
name: User Service CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run test:coverage

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: xshopai/user-service:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: azure/k8s-deploy@v4
        with:
          manifests: k8s/deployment.yaml
          images: xshopai/user-service:${{ github.sha }}
```

---

## 9. Monitoring & Alerts

### 9.1 Key Metrics

| Metric               | Warning | Critical | Action                     |
| -------------------- | ------- | -------- | -------------------------- |
| Error Rate           | > 1%    | > 5%     | Investigate logs, rollback |
| Response Time (p95)  | > 150ms | > 300ms  | Scale up, optimize queries |
| CPU Usage            | > 70%   | > 90%    | Scale horizontally         |
| Memory Usage         | > 80%   | > 95%    | Investigate memory leak    |
| Database Connections | > 80    | > 95     | Increase pool size         |
| Service Uptime       | < 99.5% | < 99%    | Incident response          |

### 10.2 Alerting Rules

**PagerDuty Alerts:**

- Service down (critical)
- Error rate > 5% (critical)
- Response time > 300ms (warning)
- Database connection failures (critical)

**Slack Alerts:**

- Deployment notifications
- Warning-level alerts
- Test failure notifications

### 9.3 Dashboards

**Grafana Dashboard:**

- Request rate (req/s)
- Response time percentiles (p50, p95, p99)
- Error rate (%)
- Database query time
- Memory/CPU usage
- Active connections

---

## 10. Risks & Mitigations

| Risk                       | Impact   | Probability | Mitigation                                       |
| -------------------------- | -------- | ----------- | ------------------------------------------------ |
| MongoDB downtime           | High     | Low         | Replica set, automated failover                  |
| Message broker unavailable | Medium   | Low         | Circuit breaker, retry logic                     |
| JWT validation failure     | Medium   | Medium      | Continue without auth, log warnings              |
| GDPR compliance violation  | High     | Low         | Legal review, data privacy audit                 |
| Performance degradation    | High     | Medium      | Caching, database indexing, horizontal scaling   |
| Security breach            | Critical | Low         | Security audits, penetration testing, monitoring |

---

## 11. Compliance & Legal

### 11.1 GDPR Compliance

- ✅ Right to access: Users can export their data
- ✅ Right to erasure: Users can delete their accounts
- ✅ Right to rectification: Users can update their data
- ✅ Data portability: Export in JSON format
- ✅ Consent management: Email/SMS preferences
- ✅ Data retention: 30-day grace period after deletion

### 11.2 PCI-DSS Compliance (Payment Methods)

- ✅ No full card numbers stored (last 4 digits only)
- ✅ No CVV storage
- ✅ Tokenization via payment gateway
- ✅ Encrypted data in transit (HTTPS)
- ✅ Encrypted data at rest (MongoDB encryption)

### 11.3 Data Privacy

- Password hashing (bcrypt, cost 12)
- PII redaction in logs
- Access control (RBAC)
- Audit trails for admin actions
- Data minimization (collect only necessary data)

---

## 12. Documentation References

### 12.1 Developer Documentation

- [README.md](README.md) - Getting started guide
- [API.md](API.md) - API reference (to be created)
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture (to be created)
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines (to be created)

### 12.2 Runbooks

- [Deployment Runbook](runbooks/deployment.md) - Deployment procedures (to be created)
- [Incident Response Runbook](runbooks/incident-response.md) - Incident handling (to be created)
- [Monitoring Runbook](runbooks/monitoring.md) - Monitoring setup (to be created)

### 12.3 API Documentation

- Swagger/OpenAPI spec (to be generated)
- Postman collection (to be created)
- GraphQL schema (future)

---

## 13. Approval & Sign-off

| Role             | Name | Signature | Date |
| ---------------- | ---- | --------- | ---- |
| Product Manager  | TBD  |           |      |
| Engineering Lead | TBD  |           |      |
| Security Lead    | TBD  |           |      |
| DevOps Lead      | TBD  |           |      |

---

## 14. Revision History

| Version | Date       | Author        | Changes                                        |
| ------- | ---------- | ------------- | ---------------------------------------------- |
| 1.0     | 2025-10-24 | xShop.ai Team | Initial PRD creation                           |
| 1.1     | 2025-01-XX | xShop.ai Team | Added Future Enhancements section (Section 13) |

---

## 15. Appendix

### 15.1 Glossary

- **JWT**: JSON Web Token (authentication token)
- **RBAC**: Role-Based Access Control
- **GDPR**: General Data Protection Regulation
- **PCI-DSS**: Payment Card Industry Data Security Standard
- **ODM**: Object-Document Mapper (Mongoose)
- **SLA**: Service Level Agreement
- **RTO**: Recovery Time Objective
- **RPO**: Recovery Point Objective

### 15.2 References

- [xShop.ai Architecture Guide](../../docs/ARCHITECTURE.md)
- [Event-Driven Architecture](../../docs/EVENT_DRIVEN_ARCHITECTURE.md)
- [MongoDB Best Practices](https://www.mongodb.com/docs/manual/administration/production-notes/)
- [Node.js Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)

---

**Document Status:** ✅ Approved  
**Next Review Date:** 2026-01-24
