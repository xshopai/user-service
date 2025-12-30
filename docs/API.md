# API Reference

Complete API documentation for the User Service.

## Base URL

- **Local**: `http://localhost:1002`
- **Local (via Dapr)**: `http://localhost:3502/v1.0/invoke/user-service/method`
- **Dev**: `https://user.azurewebsites.net`
- **Production**: `https://user-prod.azurewebsites.net`

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

### Token Structure

```json
{
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "role": "customer",
  "iat": 1699999999,
  "exp": 1700086399
}
```

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [ ... ]
  }
}
```

## Endpoints

### Operational Endpoints

#### Health Check

Check service health status.

```http
GET /health
```

**Response**: `200 OK`

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

#### Readiness Check

Check if service is ready to accept requests.

```http
GET /ready
```

**Response**: `200 OK`

```json
{
  "ready": true,
  "checks": {
    "database": "ready",
    "dapr": "ready"
  }
}
```

#### Liveness Check

Check if service is alive (for container orchestration).

```http
GET /live
```

**Response**: `200 OK`

```json
{
  "alive": true
}
```

---

### User Management

#### Create User

Register a new user.

```http
POST /api/users
Content-Type: application/json
```

**Request Body**:

```json
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890"
}
```

**Response**: `201 Created`

```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+1234567890",
    "role": "customer",
    "isActive": true,
    "isEmailVerified": false,
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "User created successfully"
}
```

**Validation Rules**:
- `email`: Valid email format, unique
- `password`: Min 8 characters, must include uppercase, lowercase, number, special char
- `firstName`: 2-50 characters
- `lastName`: 2-50 characters
- `phoneNumber`: Valid phone format (optional)

**Error Responses**:

- `400 Bad Request`: Validation errors
- `409 Conflict`: Email already exists

#### Get User by ID

Retrieve user details.

```http
GET /api/users/:userId
Authorization: Bearer <token>
```

**Path Parameters**:
- `userId` (string): User's MongoDB ObjectId

**Response**: `200 OK`

```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+1234567890",
    "role": "customer",
    "isActive": true,
    "isEmailVerified": true,
    "emailVerifiedAt": "2024-01-15T12:00:00.000Z",
    "lastLoginAt": "2024-01-20T09:15:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-20T09:15:00.000Z"
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: User not found

#### Update User

Update user information.

```http
PUT /api/users/:userId
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phoneNumber": "+1234567890",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  }
}
```

**Response**: `200 OK`

```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Smith",
    "phoneNumber": "+1234567890",
    "address": { ... },
    "updatedAt": "2024-01-20T10:30:00.000Z"
  },
  "message": "User updated successfully"
}
```

**Error Responses**:
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Cannot update another user's profile
- `404 Not Found`: User not found

#### Delete User

Soft delete a user (marks as inactive).

```http
DELETE /api/users/:userId
Authorization: Bearer <token>
```

**Response**: `200 OK`

```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: User not found

#### List Users

Retrieve paginated list of users (Admin only).

```http
GET /api/users?page=1&limit=20&role=customer&status=active
Authorization: Bearer <token>
```

**Query Parameters**:
- `page` (number, default: 1): Page number
- `limit` (number, default: 20, max: 100): Items per page
- `role` (string): Filter by role (customer, admin)
- `status` (string): Filter by status (active, inactive)
- `search` (string): Search by email, first name, or last name

**Response**: `200 OK`

```json
{
  "success": true,
  "data": {
    "users": [ ... ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Requires admin role

---

### Email Verification

#### Send Verification Email

Request email verification.

```http
POST /api/users/:userId/verify-email/send
Authorization: Bearer <token>
```

**Response**: `200 OK`

```json
{
  "success": true,
  "message": "Verification email sent"
}
```

#### Verify Email

Confirm email with verification token.

```http
POST /api/users/verify-email/:token
```

**Response**: `200 OK`

```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid or expired token
- `404 Not Found`: User not found

---

### Password Management

#### Change Password

Change user password (requires current password).

```http
POST /api/users/:userId/change-password
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!",
  "confirmPassword": "NewPass456!"
}
```

**Response**: `200 OK`

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Responses**:
- `400 Bad Request`: Passwords don't match or weak password
- `401 Unauthorized`: Current password incorrect
- `404 Not Found`: User not found

#### Request Password Reset

Request password reset email.

```http
POST /api/users/password-reset/request
Content-Type: application/json
```

**Request Body**:

```json
{
  "email": "john.doe@example.com"
}
```

**Response**: `200 OK`

```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

**Note**: Returns 200 even if email doesn't exist (security measure).

#### Reset Password

Reset password using reset token.

```http
POST /api/users/password-reset/:token
Content-Type: application/json
```

**Request Body**:

```json
{
  "newPassword": "NewPass789!",
  "confirmPassword": "NewPass789!"
}
```

**Response**: `200 OK`

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid token or passwords don't match
- `404 Not Found`: Reset token expired or invalid

---

### Admin Operations

#### Update User Role

Change user role (Admin only).

```http
PATCH /api/users/:userId/role
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "role": "admin"
}
```

**Response**: `200 OK`

```json
{
  "success": true,
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "role": "admin"
  },
  "message": "User role updated"
}
```

#### Activate/Deactivate User

Enable or disable user account (Admin only).

```http
PATCH /api/users/:userId/status
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "isActive": false
}
```

**Response**: `200 OK`

```json
{
  "success": true,
  "message": "User status updated"
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## Rate Limiting

- **Default**: 100 requests per minute per IP
- **Authenticated**: 1000 requests per minute per user
- **Admin**: No limit

**Rate Limit Headers**:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

## Pagination

All list endpoints support pagination:

```http
GET /api/users?page=2&limit=50
```

**Response includes**:
```json
{
  "pagination": {
    "page": 2,
    "limit": 50,
    "total": 500,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

## CORS

Allowed origins configured via `CORS_ORIGINS` environment variable.

**Headers**:
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Versioning

Current API version: **v1**

Future versions will be available at `/api/v2/...`

## Testing APIs

### Using cURL

```bash
# Create user
curl -X POST http://localhost:1002/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","firstName":"Test","lastName":"User"}'

# Get user (with auth)
curl -X GET http://localhost:1002/api/users/507f1f77bcf86cd799439011 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Using Postman

Import collection: [Download user-service.postman_collection.json](../tests/postman/user-service.postman_collection.json)

### Using VS Code REST Client

See examples in [tests/api/requests.http](../tests/api/requests.http)

## Next Steps

- [Development Guide](DEVELOPMENT.md) - Set up local environment
- [Testing Guide](TESTING.md) - Write API tests
- [Security Guide](SECURITY.md) - Authentication & authorization
