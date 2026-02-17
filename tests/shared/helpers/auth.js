/**
 * Authentication Helper
 * Provides authentication utilities for tests
 */
import { post, get } from './api.js';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:8004';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:8002';

/**
 * Register a new user via auth-service
 * Throws axios-style error for non-201 responses
 */
export async function registerUser(userData) {
  const response = await post(`${AUTH_SERVICE_URL}/api/auth/register`, userData);
  if (response.status !== 201) {
    const error = new Error(`Registration failed: ${response.status}`);
    error.response = response;
    throw error;
  }
  return response.data;
}

/**
 * Register a new user (returns response directly)
 */
export async function register(userData) {
  const response = await post(`${AUTH_SERVICE_URL}/api/auth/register`, userData);
  return response;
}

/**
 * Login user and get JWT token (returns response directly)
 */
export async function login(email, password) {
  const response = await post(`${AUTH_SERVICE_URL}/api/auth/login`, { email, password });
  // For tests expecting errors, we need to throw with response attached
  if (response.status >= 400) {
    const error = new Error(`Login failed: ${response.status}`);
    error.response = response;
    throw error;
  }
  return response;
}

/**
 * Get auth token for a user (register + login)
 */
export async function getAuthToken(userData) {
  // Register user
  const registerResponse = await register(userData);
  if (registerResponse.status !== 201) {
    throw new Error(`Failed to register user: ${registerResponse.status}`);
  }

  // Login user
  const loginResponse = await login(userData.email, userData.password);
  if (loginResponse.status !== 200) {
    throw new Error(`Failed to login user: ${loginResponse.status}`);
  }

  return loginResponse.data.token;
}

/**
 * Create test user and get token in one step
 */
export async function createAuthenticatedUser(email, password = 'Test@123456', firstName = 'Test', lastName = 'User') {
  const userData = { email, password, firstName, lastName };
  const token = await getAuthToken(userData);

  // Get user details
  const userResponse = await get(`${USER_SERVICE_URL}/api/users/findByEmail?email=${encodeURIComponent(email)}`, {
    token,
  });

  return {
    user: userResponse.data,
    token,
  };
}

/**
 * Verify JWT token
 */
export async function verifyToken(token) {
  const response = await get(`${AUTH_SERVICE_URL}/api/auth/verify`, { token });
  return response;
}

export default {
  registerUser,
  register,
  login,
  getAuthToken,
  createAuthenticatedUser,
  verifyToken,
};
