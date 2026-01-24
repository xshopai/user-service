# User Service - Product Requirements Document

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope](#2-scope)
3. [User Stories](#3-user-stories)
4. [Functional Requirements](#4-functional-requirements)
5. [Traceability Matrix](#5-traceability-matrix)
6. [Non-Functional Requirements](#6-non-functional-requirements)

---

## 1. Executive Summary

### 1.1 Purpose

The User Service is a core microservice within the xshopai e-commerce platform responsible for managing user accounts, profiles, and related data. It serves as the single source of truth for user information across the platform.

### 1.2 Business Objectives

| Objective                    | Description                                                              |
| ---------------------------- | ------------------------------------------------------------------------ |
| **Centralized User Data**    | Single source of truth for user profiles, addresses, and payment methods |
| **Self-Service Management**  | Enable users to manage their own profile data without support            |
| **Security & Privacy**       | GDPR-compliant user data management with encryption and audit trails     |
| **Support Admin Operations** | Allow administrators to view and manage user accounts                    |

### 1.3 Success Metrics

| Metric                      | Target  | Description                                      |
| --------------------------- | ------- | ------------------------------------------------ |
| API Response Time (p95)     | < 100ms | 95th percentile response time for user queries   |
| User Creation Success Rate  | > 98%   | Percentage of valid user creation requests       |
| Profile Update Success Rate | > 99%   | Percentage of valid profile updates that succeed |
| Service Availability        | 99.9%   | Uptime during business hours                     |

### 1.4 Target Users

| User              | Interaction                                                                   |
| ----------------- | ----------------------------------------------------------------------------- |
| **Auth Service**  | Creates user records during registration, queries user by email for login     |
| **Order Service** | Retrieves user addresses for shipping, retrieves payment methods for checkout |
| **Admin Users**   | View user accounts, manage users, view statistics via Admin UI                |
| **Customers**     | Self-service profile management via Customer UI                               |

---

## 2. Scope

### 2.1 In Scope

- User profile CRUD operations
- Address management (shipping/billing)
- Payment method management (tokenized, last 4 digits only)
- Wishlist management
- User preferences management
- Account activation/deactivation
- Admin user management operations
- User lifecycle event publishing
- Audit event publishing (consumed by audit-service)

### 2.2 Out of Scope

- Authentication/login (handled by auth-service)
- Password management (handled by auth-service)
- Email verification workflow (handled by auth-service)
- Payment processing (handled by payment-service)
- Order history (handled by order-service)
- Product recommendations
- User analytics and reporting

---

## 3. User Stories

### 3.1 Profile Management

**As a** Customer  
**I want to** view and update my profile information  
**So that** my account details are accurate

**Acceptance Criteria:**

- [ ] Authenticated users can retrieve their profile via GET /users
- [ ] Authenticated users can update firstName, lastName, phoneNumber, preferences
- [ ] Email cannot be changed via this endpoint
- [ ] Returns updated profile with updatedAt timestamp
- [ ] Publishes `user.updated` event after successful update

---

### 3.2 Address Management

**As a** Customer  
**I want to** add, update, and remove shipping/billing addresses  
**So that** I can use them during checkout

**Acceptance Criteria:**

- [ ] Users can add multiple addresses (shipping or billing type)
- [ ] One address can be marked as default per type
- [ ] Users can update any of their addresses
- [ ] Users can delete addresses
- [ ] Address includes: fullName, addressLine1/2, city, state, postalCode, country, phoneNumber

---

### 3.3 Payment Method Management

**As a** Customer  
**I want to** save payment methods for faster checkout  
**So that** I don't have to enter card details every time

**Acceptance Criteria:**

- [ ] Users can add credit/debit cards or PayPal
- [ ] Only last 4 digits of card stored (PCI-DSS compliance)
- [ ] One payment method can be marked as default
- [ ] Users can update or remove payment methods
- [ ] Includes billing address reference

---

### 3.4 Wishlist Management

**As a** Customer  
**I want to** save products to my wishlist  
**So that** I can purchase them later

**Acceptance Criteria:**

- [ ] Users can add products to wishlist (by productId)
- [ ] Users can view their wishlist
- [ ] Users can add notes to wishlist items
- [ ] Users can remove items from wishlist
- [ ] Duplicate products prevented

---

### 3.5 Admin User Management

**As an** Admin User  
**I want to** view and manage all user accounts  
**So that** I can support customers and maintain the platform

**Acceptance Criteria:**

- [ ] View paginated list of all users
- [ ] View user statistics (total, active, new registrations)
- [ ] View recently registered users
- [ ] View individual user details by ID
- [ ] Update user profiles (admin override)
- [ ] Deactivate or delete user accounts
- [ ] All operations require admin authentication

---

## 4. Functional Requirements

### 4.1 Get User Profile

**Description:**  
The system shall provide an API endpoint for authenticated users to retrieve their profile.

**Functional Details:**

| Aspect   | Specification                                            |
| -------- | -------------------------------------------------------- |
| Endpoint | `GET /users`                                             |
| Output   | Full user profile including addresses, payment, wishlist |
| Auth     | JWT required (extracts userId from token)                |

**Acceptance Criteria:**

- [ ] Returns complete user profile for authenticated user
- [ ] Excludes password field from response
- [ ] Includes nested: addresses, paymentMethods, wishlist, preferences
- [ ] Response time < 100ms

**Notes:** Primary endpoint for profile page in Customer UI.

---

### 4.2 Update User Profile

**Description:**  
The system shall provide an API endpoint to update user profile information.

**Functional Details:**

| Aspect   | Specification                                    |
| -------- | ------------------------------------------------ |
| Endpoint | `PATCH /users`                                   |
| Input    | Partial user object (firstName, lastName, phone) |
| Output   | Updated user object                              |
| Auth     | JWT required                                     |

**Acceptance Criteria:**

- [ ] Updates only provided fields (partial update)
- [ ] Cannot update email or password via this endpoint
- [ ] Sets updatedAt timestamp
- [ ] Publishes `user.updated` event

**Notes:** Email changes require separate verification flow (out of scope).

---

### 4.3 Delete User Account

**Description:**  
The system shall provide an API endpoint for users to delete their account.

**Functional Details:**

| Aspect   | Specification                    |
| -------- | -------------------------------- |
| Endpoint | `DELETE /users`                  |
| Output   | 200 OK with confirmation message |
| Auth     | JWT required                     |

**Acceptance Criteria:**

- [ ] Removes user record from database
- [ ] Publishes `user.deleted` event for cascade cleanup
- [ ] Returns success confirmation

**Notes:** GDPR right to erasure compliance.

---

### 4.4 Add Address

**Description:**  
The system shall provide an API endpoint to add an address to user profile.

**Functional Details:**

| Aspect   | Specification                        |
| -------- | ------------------------------------ |
| Endpoint | `POST /users/addresses`              |
| Input    | Address object with type and details |
| Output   | Address with generated addressId     |
| Auth     | JWT required                         |

**Acceptance Criteria:**

- [ ] Creates address as embedded document in user
- [ ] Validates all required address fields
- [ ] If isDefault=true, unsets previous default for that type
- [ ] Returns 200 OK with created address

**Notes:** Address stored as embedded document for performance.

---

### 4.5 Update Address

**Description:**  
The system shall provide an API endpoint to update an existing address.

**Functional Details:**

| Aspect   | Specification                        |
| -------- | ------------------------------------ |
| Endpoint | `PATCH /users/addresses/{addressId}` |
| Input    | Partial address object               |
| Auth     | JWT required                         |

**Acceptance Criteria:**

- [ ] Updates only provided fields
- [ ] Validates address belongs to authenticated user
- [ ] Returns 404 if address not found

---

### 4.6 Delete Address

**Description:**  
The system shall provide an API endpoint to remove an address.

**Functional Details:**

| Aspect   | Specification                         |
| -------- | ------------------------------------- |
| Endpoint | `DELETE /users/addresses/{addressId}` |
| Auth     | JWT required                          |

**Acceptance Criteria:**

- [ ] Removes address from user's addresses array
- [ ] Returns 404 if address not found
- [ ] Returns 200 OK on success

---

### 4.7 List Addresses

**Description:**  
The system shall provide an API endpoint to list all user addresses.

**Functional Details:**

| Aspect   | Specification            |
| -------- | ------------------------ |
| Endpoint | `GET /users/addresses`   |
| Output   | Array of address objects |
| Auth     | JWT required             |

**Acceptance Criteria:**

- [ ] Returns all addresses for authenticated user
- [ ] Empty array if no addresses

---

### 4.8 Add Payment Method

**Description:**  
The system shall provide an API endpoint to add a payment method.

**Functional Details:**

| Aspect   | Specification                              |
| -------- | ------------------------------------------ |
| Endpoint | `POST /users/paymentmethods`               |
| Input    | Payment method with type, lastFour, expiry |
| Auth     | JWT required                               |

**Acceptance Criteria:**

- [ ] Stores only last 4 digits (PCI-DSS compliance)
- [ ] Supports types: credit_card, debit_card, paypal
- [ ] If isDefault=true, unsets previous default
- [ ] Returns created payment method with paymentId

**Notes:** Full card data sent directly to payment gateway, never stored.

---

### 4.9 Update Payment Method

**Description:**  
The system shall provide an API endpoint to update a payment method.

**Functional Details:**

| Aspect   | Specification                             |
| -------- | ----------------------------------------- |
| Endpoint | `PATCH /users/paymentmethods/{paymentId}` |
| Auth     | JWT required                              |

**Acceptance Criteria:**

- [ ] Updates expiry date, billing address, default status
- [ ] Cannot update card number (must delete and re-add)
- [ ] Returns 404 if payment method not found

---

### 4.10 Delete Payment Method

**Description:**  
The system shall provide an API endpoint to remove a payment method.

**Functional Details:**

| Aspect   | Specification                              |
| -------- | ------------------------------------------ |
| Endpoint | `DELETE /users/paymentmethods/{paymentId}` |
| Auth     | JWT required                               |

**Acceptance Criteria:**

- [ ] Removes payment method from user profile
- [ ] Returns 404 if not found
- [ ] Returns 200 OK on success

---

### 4.11 Add to Wishlist

**Description:**  
The system shall provide an API endpoint to add a product to wishlist.

**Functional Details:**

| Aspect   | Specification             |
| -------- | ------------------------- |
| Endpoint | `POST /users/wishlist`    |
| Input    | productId, optional notes |
| Auth     | JWT required              |

**Acceptance Criteria:**

- [ ] Adds product to wishlist with timestamp
- [ ] Rejects duplicate productId
- [ ] Returns created wishlist item

---

### 4.12 Remove from Wishlist

**Description:**  
The system shall provide an API endpoint to remove a product from wishlist.

**Functional Details:**

| Aspect   | Specification                         |
| -------- | ------------------------------------- |
| Endpoint | `DELETE /users/wishlist/{wishlistId}` |
| Auth     | JWT required                          |

**Acceptance Criteria:**

- [ ] Removes item from wishlist array
- [ ] Returns 404 if not found
- [ ] Returns 200 OK on success

---

### 4.13 Admin List Users

**Description:**  
The system shall provide an API endpoint for admins to list all users.

**Functional Details:**

| Aspect     | Specification             |
| ---------- | ------------------------- |
| Endpoint   | `GET /admin/users`        |
| Pagination | Query params: page, limit |
| Default    | page=1, limit=20          |
| Auth       | Admin JWT required        |

**Acceptance Criteria:**

- [ ] Returns paginated list of users
- [ ] Includes total count for pagination UI
- [ ] Excludes password field from all users

---

### 4.14 Admin Get User Statistics

**Description:**  
The system shall provide an API endpoint to get user statistics.

**Functional Details:**

| Aspect   | Specification            |
| -------- | ------------------------ |
| Endpoint | `GET /admin/users/stats` |
| Auth     | Admin JWT required       |

**Acceptance Criteria:**

- [ ] Returns total users count
- [ ] Returns active users count
- [ ] Returns new registrations (last 7/30 days)

---

### 4.15 Admin Update User

**Description:**  
The system shall provide an API endpoint for admins to update any user.

**Functional Details:**

| Aspect   | Specification                 |
| -------- | ----------------------------- |
| Endpoint | `PATCH /admin/users/{userId}` |
| Auth     | Admin JWT required            |

**Acceptance Criteria:**

- [ ] Can update any user field (admin override)
- [ ] Can change roles, isActive status
- [ ] Returns 404 if user not found
- [ ] Publishes `user.updated` event

---

### 4.16 Admin Delete User

**Description:**  
The system shall provide an API endpoint for admins to delete any user.

**Functional Details:**

| Aspect   | Specification                  |
| -------- | ------------------------------ |
| Endpoint | `DELETE /admin/users/{userId}` |
| Auth     | Admin JWT required             |

**Acceptance Criteria:**

- [ ] Removes user record
- [ ] Publishes `user.deleted` event
- [ ] Returns 404 if user not found

---

### 4.17 Publish User Events

**Description:**  
The system shall publish events via Dapr Pub/Sub after user lifecycle operations.

**Functional Details:**

| Event              | Trigger              | Payload               |
| ------------------ | -------------------- | --------------------- |
| `user.updated`     | Profile update       | userId, updatedFields |
| `user.deleted`     | Account deletion     | userId, email         |
| `user.deactivated` | Account deactivation | userId, reason        |
| `user.reactivated` | Account reactivation | userId                |

**Acceptance Criteria:**

- [ ] Events published after successful database operation
- [ ] Events include correlationId for tracing
- [ ] Event publishing failure does not fail the API request (graceful degradation)

---

## 5. Traceability Matrix

> **Purpose:** This matrix provides a single snapshot view linking User Stories to their implementing requirements. Use this to verify coverage and track implementation status.

| User Story                           | Story Title           | Requirements                                                                                                                          |
| ------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [3.1](#31-profile-management)        | Profile Management    | [4.1](#41-get-user-profile), [4.2](#42-update-user-profile), [4.3](#43-delete-user-account), [4.17](#417-publish-user-events)         |
| [3.2](#32-address-management)        | Address Management    | [4.4](#44-add-address), [4.5](#45-update-address), [4.6](#46-delete-address), [4.7](#47-list-addresses)                               |
| [3.3](#33-payment-method-management) | Payment Method Mgmt   | [4.8](#48-add-payment-method), [4.9](#49-update-payment-method), [4.10](#410-delete-payment-method)                                   |
| [3.4](#34-wishlist-management)       | Wishlist Management   | [4.11](#411-add-to-wishlist), [4.12](#412-remove-from-wishlist)                                                                       |
| [3.5](#35-admin-user-management)     | Admin User Management | [4.13](#413-admin-list-users), [4.14](#414-admin-get-user-statistics), [4.15](#415-admin-update-user), [4.16](#416-admin-delete-user) |

**Coverage Summary:**

- Total User Stories: 5
- Total Requirements: 17
- Requirements without User Story: 0
- User Stories without Requirements: 0

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Metric                  | Target     | Description                             |
| ----------------------- | ---------- | --------------------------------------- |
| API Response Time (p95) | < 100ms    | Profile queries and update operations   |
| Throughput              | 1000 req/s | Sustained load during normal operations |

### 6.2 Reliability

| Metric                     | Target | Description                               |
| -------------------------- | ------ | ----------------------------------------- |
| Service Availability       | 99.9%  | Uptime during business hours              |
| User Creation Success Rate | > 98%  | Valid requests that complete successfully |
| Profile Update Success     | > 99%  | Valid updates that complete successfully  |

### 6.3 Security

| Requirement                                   | Priority |
| --------------------------------------------- | -------- |
| Password hashing with bcrypt (cost: 12)       | Critical |
| Admin endpoints require JWT with admin role   | Critical |
| Input validation on all endpoints             | Critical |
| PCI-DSS compliance (no full card storage)     | Critical |
| No sensitive data (passwords, tokens) in logs | High     |
| GDPR compliance (right to erasure)            | High     |

### 6.4 Observability

| Requirement                                         | Priority |
| --------------------------------------------------- | -------- |
| Health check endpoints (`/health`, `/health/ready`) | Critical |
| Structured JSON logging with correlation IDs        | High     |
| Log user operations with before/after values        | High     |
| Prometheus metrics endpoint (`/metrics`)            | High     |

---
