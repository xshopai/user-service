/**
 * User Service Helper
 * Provides user service utilities for tests
 */
import { get, post, put, del } from './api.js';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:8002';

/**
 * Create user directly via user-service (bypassing auth-service)
 * Use this for API tests that don't want auth-service dependency
 */
export async function createUser(userData, token = null) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await post(`${USER_SERVICE_URL}/api/users`, userData, { headers });
  if (response.status !== 201 && response.status !== 200) {
    throw new Error(`Failed to create user: ${response.status} - ${JSON.stringify(response.data)}`);
  }
  // Return the user data directly (not wrapped)
  return response.data;
}

/**
 * Generate test user data
 */
export function generateTestUser() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return {
    email: `test.user.${timestamp}.${random}@example.com`,
    password: 'Test@123456',
    firstName: 'Test',
    lastName: 'User',
  };
}

/**
 * Get user by ID
 */
export async function getUserById(userId, token = null) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await get(`${USER_SERVICE_URL}/api/users/${userId}`, { headers });
  if (response.status === 404) {
    const error = new Error('User not found');
    error.response = response;
    throw error;
  }
  return response.data;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email, token = null) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await get(`${USER_SERVICE_URL}/api/users/findByEmail?email=${encodeURIComponent(email)}`, {
    headers,
  });
  if (response.status === 404) {
    const error = new Error('User not found');
    error.response = response;
    throw error;
  }
  return response.data;
}

/**
 * Update user profile
 */
export async function updateUser(userId, updateData, token = null) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await put(`${USER_SERVICE_URL}/api/users/${userId}`, updateData, { headers });
  return response.data;
}

/**
 * Update user directly (for test setup - bypasses authentication)
 * Uses admin endpoint without auth for test purposes
 */
export async function updateUserDirectly(userId, updateData) {
  const response = await put(`${USER_SERVICE_URL}/admin/users/${userId}`, updateData);
  return response.data;
}

/**
 * Delete user
 */
export async function deleteUser(userId, token = null) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const response = await del(`${USER_SERVICE_URL}/api/users/${userId}`, { headers });
  return response;
}

/**
 * List all users
 */
export async function listUsers(params = {}, token = null) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const queryString = new URLSearchParams(params).toString();
  const url = `${USER_SERVICE_URL}/api/users${queryString ? `?${queryString}` : ''}`;
  const response = await get(url, { headers });
  return response.data;
}

/**
 * Sleep utility
 */
export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default {
  createUser,
  generateTestUser,
  getUserById,
  getUserByEmail,
  updateUser,
  deleteUser,
  listUsers,
  sleep,
};
