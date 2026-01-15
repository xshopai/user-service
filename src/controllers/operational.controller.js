/**
 * Operational/Infrastructure endpoints
 * These endpoints are used by monitoring systems, load balancers, and DevOps tools
 */

import mongoose from 'mongoose';
import logger from '../core/logger.js';
import config from '../core/config.js';

/**
 * Get system metrics for monitoring
 * @returns {Object} - System metrics including memory and uptime
 */
function getSystemMetrics() {
  const memoryUsage = process.memoryUsage();
  return {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
    },
    nodeVersion: process.version,
    platform: process.platform,
  };
}

/**
 * Health check - simple check that always returns 200 if server is running
 * Used for startup probes
 */
export function health(req, res) {
  res.json({
    status: 'healthy',
    service: config.service.name,
    version: config.service.version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

/**
 * Readiness check - checks if the service is ready to receive traffic
 * Checks database connectivity only (Dapr may not be ready during startup)
 */
export async function readiness(req, res) {
  try {
    const checks = {};

    // Check database connectivity using the existing connection
    const dbState = mongoose.connection.readyState;
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    const dbHealthy = dbState === 1;
    checks.database = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      readyState: dbState,
    };

    const allHealthy = dbHealthy;
    const status = allHealthy ? 'ready' : 'not ready';
    const statusCode = allHealthy ? 200 : 503;

    res.status(statusCode).json({
      status,
      service: config.service.name,
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    logger.error('Readiness check failed', { error: error.message });
    res.status(503).json({
      status: 'not ready',
      service: config.service.name,
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
}

/**
 * Liveness check - checks if the service process is alive
 * Simple check that always returns 200 if server is responding
 */
export function liveness(req, res) {
  res.json({
    status: 'alive',
    service: config.service.name,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}

/**
 * Metrics endpoint - returns system metrics
 */
export function metrics(req, res) {
  try {
    const systemMetrics = getSystemMetrics();
    res.json({
      service: config.service.name,
      ...systemMetrics,
    });
  } catch (error) {
    logger.error('Metrics collection failed', { error: error.message });
    res.status(500).json({
      service: config.service.name,
      timestamp: new Date().toISOString(),
      error: 'Metrics collection failed',
    });
  }
}
