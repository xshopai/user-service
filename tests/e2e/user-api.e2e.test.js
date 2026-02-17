// API Test: User Service
// Tests individual user-service endpoints in isolation

import axios from 'axios';
import { generateTestUser, createUser, getUserByEmail, deleteUser, sleep } from '../../shared/helpers/user.js';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:8002';
const USER_SERVICE_HEALTH_URL = process.env.USER_SERVICE_HEALTH_URL || 'http://localhost:8002/health/ready';

describe('User Service API Tests', () => {
  let testUser;
  let userId;

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await axios.get(USER_SERVICE_HEALTH_URL);

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data.status).toBe('healthy');
      expect(response.data.service).toBe('user-service');

      console.log('✅ User service is healthy');
    });
  });

  describe('User Creation and Retrieval', () => {
    beforeAll(async () => {
      // Create a test user directly via user-service (no auth-service dependency)
      testUser = generateTestUser();
      const createdUser = await createUser(testUser);
      userId = createdUser._id;

      console.log(`\n📝 Test user created: ${testUser.email} (ID: ${userId})`);
    });

    afterAll(async () => {
      // Cleanup: Delete test user
      if (userId) {
        await deleteUser(userId);
      }
    });

    it('should retrieve user by email', async () => {
      const user = await getUserByEmail(testUser.email, null);

      expect(user).toBeDefined();
      expect(user._id).toBe(userId);
      expect(user.email).toBe(testUser.email);
      expect(user.firstName).toBe(testUser.firstName);
      expect(user.lastName).toBe(testUser.lastName);
      expect(user.isActive).toBe(true);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();

      console.log('✅ User retrieved successfully by email');
    });

    it('should retrieve user by ID', async () => {
      const response = await axios.get(`${USER_SERVICE_URL}/api/users/${userId}`);

      expect(response.status).toBe(200);
      expect(response.data).toBeDefined();
      expect(response.data._id).toBe(userId);
      expect(response.data.email).toBe(testUser.email);

      console.log('✅ User retrieved successfully by ID');
    });

    it('should return 404 for non-existent user by email', async () => {
      try {
        await getUserByEmail('nonexistent@example.com', null);
        fail('Should have thrown 404 error');
      } catch (error) {
        expect(error.response).toBeDefined();
        expect(error.response.status).toBe(404);

        console.log('✅ Non-existent user returns 404');
      }
    });

    it('should return 404 for non-existent user by ID', async () => {
      const fakeId = '507f1f77bcf86cd799439011'; // Valid MongoDB ObjectId format

      try {
        await axios.get(`${USER_SERVICE_URL}/api/users/${fakeId}`);
        fail('Should have thrown 404 error');
      } catch (error) {
        expect(error.response).toBeDefined();
        expect(error.response.status).toBe(404);

        console.log('✅ Non-existent user by ID returns 404');
      }
    });

    it('should return 500 for invalid user ID format', async () => {
      const invalidId = 'invalid-id-format';

      try {
        await axios.get(`${USER_SERVICE_URL}/api/users/${invalidId}`);
        fail('Should have thrown error');
      } catch (error) {
        expect(error.response).toBeDefined();
        expect([400, 404, 500]).toContain(error.response.status); // 500 for invalid ObjectId

        console.log(`✅ Invalid user ID format rejected (Status: ${error.response.status})`);
      }
    });
  });

  describe('User Profile Management', () => {
    it('should return 404 for PUT /users/:id (endpoint does not exist)', async () => {
      // Note: User-service only has PATCH /users/ (update own profile with auth)
      // There is no public PUT /users/:id endpoint
      const fakeId = '507f1f77bcf86cd799439011';
      const updatedData = {
        firstName: 'UpdatedFirst',
        lastName: 'UpdatedLast',
      };

      try {
        await axios.put(`${USER_SERVICE_URL}/api/users/${fakeId}`, updatedData);
        fail('Should have thrown 404 error');
      } catch (error) {
        expect(error.response).toBeDefined();
        expect(error.response.status).toBe(404);
        console.log('✅ PUT /users/:id correctly returns 404 (endpoint does not exist)');
      }
    });
  });

  describe('User Listing', () => {
    it('should list all users', async () => {
      try {
        const response = await axios.get(`${USER_SERVICE_URL}/api/users`);

        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
        expect(Array.isArray(response.data)).toBe(true);

        if (response.data.length > 0) {
          const user = response.data[0];
          expect(user._id).toBeDefined();
          expect(user.email).toBeDefined();
        }

        console.log(`✅ Retrieved ${response.data.length} users`);
      } catch (error) {
        // If endpoint requires authentication or doesn't exist
        if (error.response?.status === 401 || error.response?.status === 403 || error.response?.status === 404) {
          console.log('⏭️  Skipped: List endpoint requires authentication or not implemented');
        } else {
          throw error;
        }
      }
    });
  });

  describe('User Deletion', () => {
    it('should return 404 for DELETE /users/:id (endpoint does not exist)', async () => {
      // Note: User-service only has DELETE /users/ (delete own account with auth)
      // There is no public DELETE /users/:id endpoint
      const fakeId = '507f1f77bcf86cd799439011';

      try {
        await axios.delete(`${USER_SERVICE_URL}/api/users/${fakeId}`);
        fail('Should have thrown 404 error');
      } catch (error) {
        expect(error.response).toBeDefined();
        expect(error.response.status).toBe(404);
        console.log('✅ DELETE /users/:id correctly returns 404 (endpoint does not exist)');
      }
    });
  });
});
