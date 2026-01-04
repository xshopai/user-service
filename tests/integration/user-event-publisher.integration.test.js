/**
 * Integration tests for Dapr event publishing
 * Tests CloudEvents schema compliance and event payloads
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Mock the daprClient from core/dapr.js
const mockPublishEvent = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('../../src/core/dapr.js', () => ({
  daprClient: {
    publishEvent: mockPublishEvent,
  },
}));

// Import after mocking
const userEventPublisher = await import('../../src/events/publisher.js');

describe('User Event Publisher - CloudEvents Compliance', () => {
  beforeEach(() => {
    mockPublishEvent.mockClear();
  });

  describe('publishUserCreated', () => {
    test('should publish CloudEvents 1.0 compliant event', async () => {
      const testUser = {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        displayName: 'John D.',
        phoneNumber: '+1234567890',
        isEmailVerified: true,
        isActive: true,
        roles: ['user'],
        tier: 'basic',
        createdAt: new Date('2024-01-01'),
      };

      await userEventPublisher.publishUserCreated(testUser, 'test-corr-id-123', '192.168.1.1', 'Mozilla/5.0');

      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
      const [pubsubName, topic, eventData] = mockPublishEvent.mock.calls[0];

      // Validate pub/sub configuration
      expect(pubsubName).toBe('user-pubsub');
      expect(topic).toBe('user.created');

      // Validate CloudEvents schema
      expect(eventData.specversion).toBe('1.0');
      expect(eventData.type).toBe('com.xshopai.user.created');
      expect(eventData.source).toBe('user-service');
      expect(eventData.id).toBeDefined();
      expect(eventData.time).toBeDefined();
      expect(eventData.datacontenttype).toBe('application/json');

      // Validate data payload
      expect(eventData.data.userId).toBe('507f1f77bcf86cd799439011');
      expect(eventData.data.email).toBe('test@example.com');
      expect(eventData.data.firstName).toBe('John');
      expect(eventData.data.lastName).toBe('Doe');
      expect(eventData.data.displayName).toBe('John D.');
      expect(eventData.data.phoneNumber).toBe('+1234567890');
      expect(eventData.data.isEmailVerified).toBe(true);
      expect(eventData.data.isActive).toBe(true);
      expect(eventData.data.roles).toEqual(['user']);
      expect(eventData.data.tier).toBe('basic');

      // Validate metadata
      expect(eventData.metadata.correlationId).toBe('test-corr-id-123');
      expect(eventData.metadata.ipAddress).toBe('192.168.1.1');
      expect(eventData.metadata.userAgent).toBe('Mozilla/5.0');
      expect(eventData.metadata.environment).toBe('development');
    });

    test('should handle missing optional fields gracefully', async () => {
      const testUser = {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isEmailVerified: false,
        isActive: true,
        roles: ['user'],
        tier: 'basic',
        createdAt: new Date(),
      };

      await userEventPublisher.publishUserCreated(testUser, 'test-corr-id', null, null);

      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
      const [, , eventData] = mockPublishEvent.mock.calls[0];

      expect(eventData.metadata.ipAddress).toBeNull();
      expect(eventData.metadata.userAgent).toBeNull();
    });

    test('should not throw on publish failure', async () => {
      mockPublishEvent.mockRejectedValueOnce(new Error('Connection failed'));

      const testUser = {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isEmailVerified: false,
        isActive: true,
        roles: ['user'],
        tier: 'basic',
        createdAt: new Date(),
      };

      // Should not throw
      await expect(userEventPublisher.publishUserCreated(testUser, 'test-corr-id')).resolves.not.toThrow();
    });
  });

  describe('publishUserUpdated', () => {
    test('should publish CloudEvents 1.0 compliant event', async () => {
      const testUser = {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        email: 'updated@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        displayName: 'Jane S.',
        phoneNumber: '+9876543210',
        isEmailVerified: true,
        isActive: true,
        roles: ['user', 'admin'],
        tier: 'premium',
        updatedAt: new Date('2024-02-01'),
      };

      await userEventPublisher.publishUserUpdated(
        testUser,
        'test-corr-id-456',
        '507f1f77bcf86cd799439012',
        '192.168.1.2',
        'Chrome/120.0'
      );

      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
      const [pubsubName, topic, eventData] = mockPublishEvent.mock.calls[0];

      expect(pubsubName).toBe('user-pubsub');
      expect(topic).toBe('user.updated');
      expect(eventData.type).toBe('com.xshopai.user.updated');
      expect(eventData.data.userId).toBe('507f1f77bcf86cd799439011');
      expect(eventData.data.updatedBy).toBe('507f1f77bcf86cd799439012');
      expect(eventData.data.email).toBe('updated@example.com');
      expect(eventData.data.tier).toBe('premium');
    });
  });

  describe('publishUserDeleted', () => {
    test('should publish CloudEvents 1.0 compliant event', async () => {
      await userEventPublisher.publishUserDeleted('507f1f77bcf86cd799439011', 'test-corr-id-789');

      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
      const [pubsubName, topic, eventData] = mockPublishEvent.mock.calls[0];

      expect(pubsubName).toBe('user-pubsub');
      expect(topic).toBe('user.deleted');
      expect(eventData.type).toBe('com.xshopai.user.deleted');
      expect(eventData.data.userId).toBe('507f1f77bcf86cd799439011');
      expect(eventData.data.timestamp).toBeDefined();
      expect(eventData.metadata.correlationId).toBe('test-corr-id-789');
    });
  });

  describe('publishUserLoggedIn', () => {
    test('should publish CloudEvents 1.0 compliant event', async () => {
      await userEventPublisher.publishUserLoggedIn(
        '507f1f77bcf86cd799439011',
        'user@example.com',
        'test-corr-id-login',
        '10.0.0.1',
        'Safari/17.0'
      );

      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
      const [pubsubName, topic, eventData] = mockPublishEvent.mock.calls[0];

      expect(pubsubName).toBe('user-pubsub');
      expect(topic).toBe('user.logged_in');
      expect(eventData.type).toBe('com.xshopai.user.logged_in');
      expect(eventData.data.userId).toBe('507f1f77bcf86cd799439011');
      expect(eventData.data.email).toBe('user@example.com');
      expect(eventData.data.timestamp).toBeDefined();
      expect(eventData.metadata.ipAddress).toBe('10.0.0.1');
      expect(eventData.metadata.userAgent).toBe('Safari/17.0');
    });
  });

  describe('publishUserLoggedOut', () => {
    test('should publish CloudEvents 1.0 compliant event', async () => {
      await userEventPublisher.publishUserLoggedOut(
        '507f1f77bcf86cd799439011',
        'user@example.com',
        'test-corr-id-logout'
      );

      expect(mockPublishEvent).toHaveBeenCalledTimes(1);
      const [pubsubName, topic, eventData] = mockPublishEvent.mock.calls[0];

      expect(pubsubName).toBe('user-pubsub');
      expect(topic).toBe('user.logged_out');
      expect(eventData.type).toBe('com.xshopai.user.logged_out');
      expect(eventData.data.userId).toBe('507f1f77bcf86cd799439011');
      expect(eventData.data.email).toBe('user@example.com');
      expect(eventData.data.timestamp).toBeDefined();
    });
  });

  describe('Event ID Uniqueness', () => {
    test('should generate unique event IDs for multiple events', async () => {
      const testUser = {
        _id: { toString: () => '507f1f77bcf86cd799439011' },
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        isEmailVerified: true,
        isActive: true,
        roles: ['user'],
        tier: 'basic',
        createdAt: new Date(),
      };

      await userEventPublisher.publishUserCreated(testUser, 'corr-1');
      await userEventPublisher.publishUserCreated(testUser, 'corr-2');
      await userEventPublisher.publishUserCreated(testUser, 'corr-3');

      expect(mockPublishEvent).toHaveBeenCalledTimes(3);

      const eventIds = mockPublishEvent.mock.calls.map((call) => call[2].id);
      const uniqueIds = new Set(eventIds);

      expect(uniqueIds.size).toBe(3); // All IDs should be unique
    });
  });
});
