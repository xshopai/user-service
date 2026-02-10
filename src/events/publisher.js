/**
 * User Service Event Publisher
 * Publishes CloudEvents-compliant events via messaging abstraction layer
 *
 * Uses the messaging factory pattern to support multiple providers:
 * - Dapr (default) - for Azure Container Apps, AKS, local Docker Compose
 * - RabbitMQ - for direct integration without Dapr
 * - Azure Service Bus - for Azure App Service deployments
 *
 * Provider is selected via MESSAGING_PROVIDER environment variable.
 */
import { getMessagingProvider } from '../messaging/index.js';
import logger from '../core/logger.js';
import config from '../core/config.js';

/**
 * Get the messaging provider instance
 * @returns {Promise<import('../messaging/provider.js').default>} Messaging provider
 */
async function getProvider() {
  try {
    return await getMessagingProvider();
  } catch (error) {
    logger.error('Failed to get messaging provider', null, {
      operation: 'messaging_init',
      error: error.message,
    });
    return null;
  }
}

/**
 * Publish user.created event
 * @param {object} user - User object that was created
 * @param {string} traceId - Trace ID for distributed tracing
 * @param {string} [ipAddress] - IP address of the client making the request
 * @param {string} [userAgent] - User agent string of the client
 * @returns {Promise<void>}
 */
export async function publishUserCreated(user, traceId, ipAddress = null, userAgent = null) {
  const provider = await getProvider();
  if (!provider) {
    logger.debug('Messaging provider not available, skipping event publish', null, {
      operation: 'event_publish',
      eventType: 'user.created',
      userId: user._id.toString(),
    });
    return;
  }

  try {
    const eventData = {
      specversion: '1.0',
      type: 'com.xshopai.user.created',
      source: 'user-service',
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data: {
        userId: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive,
        roles: user.roles,
        createdAt: user.createdAt,
      },
      metadata: {
        traceId,
        ipAddress,
        userAgent,
        environment: config.service.nodeEnv,
      },
    };

    await provider.publishEvent('user.created', eventData, traceId);

    logger.info('Published user.created event', null, {
      operation: 'event_publish',
      eventType: 'user.created',
      userId: user._id.toString(),
      traceId,
    });
  } catch (error) {
    logger.error('Failed to publish user.created event', null, {
      operation: 'event_publish',
      eventType: 'user.created',
      userId: user._id?.toString(),
      error: error.message,
      traceId,
    });
    // Don't throw - graceful degradation
  }
}

/**
 * Publish user.updated event
 * @param {object} user - Updated user object
 * @param {string} traceId - Trace ID for distributed tracing
 * @param {string} [updatedBy] - ID of user who performed the update
 * @param {string} [ipAddress] - IP address of the client
 * @param {string} [userAgent] - User agent string
 * @returns {Promise<void>}
 */
export async function publishUserUpdated(user, traceId, updatedBy = null, ipAddress = null, userAgent = null) {
  const provider = getProvider();
  if (!provider) {
    logger.debug('Messaging provider not available, skipping event publish', null, {
      operation: 'event_publish',
      eventType: 'user.updated',
      userId: user._id.toString(),
    });
    return;
  }

  try {
    const eventData = {
      specversion: '1.0',
      type: 'com.xshopai.user.updated',
      source: 'user-service',
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data: {
        userId: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive,
        roles: user.roles,
        updatedAt: user.updatedAt,
        updatedBy,
      },
      metadata: {
        traceId,
        ipAddress,
        userAgent,
        environment: config.service.nodeEnv,
      },
    };

    await provider.publishEvent('user.updated', eventData, traceId);

    logger.info('Published user.updated event', null, {
      operation: 'event_publish',
      eventType: 'user.updated',
      userId: user._id.toString(),
      traceId,
    });
  } catch (error) {
    logger.error('Failed to publish user.updated event', null, {
      operation: 'event_publish',
      eventType: 'user.updated',
      userId: user._id?.toString(),
      error: error.message,
      traceId,
    });
    // Don't throw - graceful degradation
  }
}

/**
 * Publish user.deleted event
 * @param {string} userId - User ID
 * @param {string} traceId - Trace ID for distributed tracing
 * @returns {Promise<void>}
 */
export async function publishUserDeleted(userId, traceId) {
  const provider = getProvider();
  if (!provider) {
    logger.debug('Messaging provider not available, skipping event publish', null, {
      operation: 'event_publish',
      eventType: 'user.deleted',
      userId,
    });
    return;
  }

  try {
    const eventData = {
      specversion: '1.0',
      type: 'com.xshopai.user.deleted',
      source: 'user-service',
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data: {
        userId,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        traceId,
        environment: config.service.nodeEnv,
      },
    };

    await provider.publishEvent('user.deleted', eventData, traceId);

    logger.info('Published user.deleted event', null, {
      operation: 'event_publish',
      eventType: 'user.deleted',
      userId,
      traceId,
    });
  } catch (error) {
    logger.error('Failed to publish user.deleted event', null, {
      operation: 'event_publish',
      eventType: 'user.deleted',
      userId,
      error: error.message,
      traceId,
    });
    // Don't throw - graceful degradation
  }
}

/**
 * Publish user.logged_in event
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @param {string} traceId - Trace ID for distributed tracing
 * @param {string} [ipAddress] - IP address
 * @param {string} [userAgent] - User agent
 * @returns {Promise<void>}
 */
export async function publishUserLoggedIn(userId, email, traceId, ipAddress = null, userAgent = null) {
  const provider = getProvider();
  if (!provider) {
    logger.debug('Messaging provider not available, skipping event publish', null, {
      operation: 'event_publish',
      eventType: 'user.logged_in',
      userId,
    });
    return;
  }

  try {
    const eventData = {
      specversion: '1.0',
      type: 'com.xshopai.user.logged_in',
      source: 'user-service',
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data: {
        userId,
        email,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        traceId,
        ipAddress,
        userAgent,
        environment: config.service.nodeEnv,
      },
    };

    await provider.publishEvent('user.logged_in', eventData, traceId);

    logger.info('Published user.logged_in event', null, {
      operation: 'event_publish',
      eventType: 'user.logged_in',
      userId,
      traceId,
    });
  } catch (error) {
    logger.error('Failed to publish user.logged_in event', null, {
      operation: 'event_publish',
      eventType: 'user.logged_in',
      userId,
      error: error.message,
      traceId,
    });
    // Don't throw - graceful degradation
  }
}

/**
 * Publish user.logged_out event
 * @param {string} userId - User ID
 * @param {string} email - User email
 * @param {string} traceId - Trace ID for distributed tracing
 * @returns {Promise<void>}
 */
export async function publishUserLoggedOut(userId, email, traceId) {
  const provider = getProvider();
  if (!provider) {
    logger.debug('Messaging provider not available, skipping event publish', null, {
      operation: 'event_publish',
      eventType: 'user.logged_out',
      userId,
    });
    return;
  }

  try {
    const eventData = {
      specversion: '1.0',
      type: 'com.xshopai.user.logged_out',
      source: 'user-service',
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data: {
        userId,
        email,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        traceId,
        environment: config.service.nodeEnv,
      },
    };

    await provider.publishEvent('user.logged_out', eventData, traceId);

    logger.info('Published user.logged_out event', null, {
      operation: 'event_publish',
      eventType: 'user.logged_out',
      userId,
      traceId,
    });
  } catch (error) {
    logger.error('Failed to publish user.logged_out event', null, {
      operation: 'event_publish',
      eventType: 'user.logged_out',
      userId,
      error: error.message,
      traceId,
    });
    // Don't throw - graceful degradation
  }
}

/**
 * Publish user.deactivated event
 * @param {string} userId - User ID
 * @param {string} traceId - Trace ID for distributed tracing
 * @param {string} [deactivatedBy] - ID of user who performed deactivation (null for self)
 * @param {string} [reason] - Reason for deactivation
 * @returns {Promise<void>}
 */
export async function publishUserDeactivated(userId, traceId, deactivatedBy = null, reason = null) {
  const provider = getProvider();
  if (!provider) {
    logger.debug('Messaging provider not available, skipping event publish', null, {
      operation: 'event_publish',
      eventType: 'user.deactivated',
      userId,
    });
    return;
  }

  try {
    const eventData = {
      specversion: '1.0',
      type: 'com.xshopai.user.deactivated',
      source: 'user-service',
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data: {
        userId,
        deactivatedAt: new Date().toISOString(),
        deactivatedBy: deactivatedBy || userId,
        reason: reason || 'user_request',
      },
      metadata: {
        traceId,
        environment: config.service.nodeEnv,
      },
    };

    await provider.publishEvent('user.deactivated', eventData, traceId);

    logger.info('Published user.deactivated event', null, {
      operation: 'event_publish',
      eventType: 'user.deactivated',
      userId,
      traceId,
    });
  } catch (error) {
    logger.error('Failed to publish user.deactivated event', null, {
      operation: 'event_publish',
      eventType: 'user.deactivated',
      userId,
      error: error.message,
      traceId,
    });
    // Don't throw - graceful degradation
  }
}

/**
 * Publish user.reactivated event
 * @param {string} userId - User ID
 * @param {string} traceId - Trace ID for distributed tracing
 * @param {string} [reactivatedBy] - ID of user who performed reactivation (null for self)
 * @returns {Promise<void>}
 */
export async function publishUserReactivated(userId, traceId, reactivatedBy = null) {
  const provider = getProvider();
  if (!provider) {
    logger.debug('Messaging provider not available, skipping event publish', null, {
      operation: 'event_publish',
      eventType: 'user.reactivated',
      userId,
    });
    return;
  }

  try {
    const eventData = {
      specversion: '1.0',
      type: 'com.xshopai.user.reactivated',
      source: 'user-service',
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      data: {
        userId,
        reactivatedAt: new Date().toISOString(),
        reactivatedBy: reactivatedBy || userId,
      },
      metadata: {
        traceId,
        environment: config.service.nodeEnv,
      },
    };

    await provider.publishEvent('user.reactivated', eventData, traceId);

    logger.info('Published user.reactivated event', null, {
      operation: 'event_publish',
      eventType: 'user.reactivated',
      userId,
      traceId,
    });
  } catch (error) {
    logger.error('Failed to publish user.reactivated event', null, {
      operation: 'event_publish',
      eventType: 'user.reactivated',
      userId,
      error: error.message,
      traceId,
    });
    // Don't throw - graceful degradation
  }
}

// Export as default object for compatibility
export default {
  publishUserCreated,
  publishUserUpdated,
  publishUserDeleted,
  publishUserLoggedIn,
  publishUserLoggedOut,
  publishUserDeactivated,
  publishUserReactivated,
};
