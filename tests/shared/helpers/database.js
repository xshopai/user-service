/**
 * Database Helper
 * Provides database utilities for test data management
 */
import { get, del } from './api.js';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:8002';

/**
 * Get user by email
 */
export async function getUserByEmail(email, token) {
  const response = await get(`${USER_SERVICE_URL}/api/users/findByEmail?email=${encodeURIComponent(email)}`, { token });
  return response;
}

/**
 * Get user by ID
 */
export async function getUserById(userId, token) {
  const response = await get(`${USER_SERVICE_URL}/api/users/${userId}`, { token });
  return response;
}

/**
 * Delete user by ID
 */
export async function deleteUserById(userId, token) {
  const response = await del(`${USER_SERVICE_URL}/api/users/${userId}`, { token });
  return response;
}

/**
 * Clean up test users by email pattern
 */
export async function cleanupTestUsers(emailPattern = 'e2e-test', token) {
  // This would need a custom endpoint in user-service to query by email pattern
  // For now, just document the pattern
  console.log(`Cleanup test users matching pattern: ${emailPattern}`);
}

export default {
  getUserByEmail,
  getUserById,
  deleteUserById,
  cleanupTestUsers,
};
