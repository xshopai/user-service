/**
 * Secret Manager Utility
 * Manages secrets retrieval from environment variables
 *
 * User Service Required Secrets (from environment variables):
 * - MONGODB_URI              : MongoDB connection string
 * - JWT_SECRET               : JWT signing secret
 * - APPLICATIONINSIGHTS_CONNECTION_STRING : Application Insights connection string
 * - SERVICE_AUTH_TOKEN       : Auth service token
 * - SERVICE_ADMIN_TOKEN      : Admin service token
 * - SERVICE_ORDER_TOKEN      : Order service token
 * - SERVICE_WEBBFF_TOKEN     : Web BFF token
 */

import logger from './logger.js';

class SecretManager {
  constructor() {
    this._cache = {};
    logger.info('Secret manager initialized (env-only mode)');
  }

  /**
   * Get a secret value from environment variables.
   *
   * @param {string} key - Secret key (e.g., 'JWT_SECRET')
   * @returns {string|null} Secret value or null if not found
   */
  getSecret(key) {
    if (this._cache[key]) {
      return this._cache[key];
    }

    const value = process.env[key];
    if (value) {
      this._cache[key] = value;
      return value;
    }

    return null;
  }

    return null;
  }

  /**
   * Get MongoDB database configuration.
   *
   * @returns {Object} Database connection parameters
   */
  getDatabaseConfig() {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error('MongoDB connection string not found. Set MONGODB_URI environment variable.');
    }

    return this._parseDatabaseUrl(uri);
  }

  /**
   * Parse MongoDB connection URL into config object
   * @param {string} url - MongoDB connection URL
   * @returns {Object} Database connection parameters
   */
  _parseDatabaseUrl(url) {
    try {
      const parsed = new URL(url);
      const authSource = parsed.searchParams.get('authSource') || 'admin';

      return {
        connectionString: url,
        host: parsed.hostname || '127.0.0.1',
        port: parseInt(parsed.port || '27018', 10),
        username: parsed.username || '',
        password: parsed.password || '',
        database: parsed.pathname.replace('/', '') || process.env.MONGODB_DB_NAME || 'user_service_db',
        authSource,
      };
    } catch (error) {
      logger.error(`Invalid database URL format: ${error.message}`);
      throw new Error('Invalid database URL format');
    }
  }

  /**
   * Get JWT configuration.
   *
   * @returns {Object} JWT configuration parameters
   */
  getJwtConfig() {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      logger.warn('JWT secret not found in environment');
      throw new Error('JWT_SECRET environment variable is required');
    }

    return {
      secret,
      algorithm: process.env.JWT_ALGORITHM || 'HS256',
      expiration: process.env.JWT_EXPIRATION || '3600',
      issuer: process.env.JWT_ISSUER || 'auth-service',
      audience: process.env.JWT_AUDIENCE || 'xshopai-platform',
    };
  }

  /**
   * Get service tokens for service-to-service auth.
   *
   * @returns {Object} Service tokens
   */
  getServiceTokens() {
    const tokenKeys = {
      'auth-service': 'SERVICE_AUTH_TOKEN',
      'admin-service': 'SERVICE_ADMIN_TOKEN',
      'order-service': 'SERVICE_ORDER_TOKEN',
      'web-bff': 'SERVICE_WEBBFF_TOKEN',
    };

    const tokens = {};
    for (const [service, key] of Object.entries(tokenKeys)) {
      const value = process.env[key];
      if (value) {
        tokens[service] = value;
      } else {
        logger.warn(`Token for '${service}' not configured (key: ${key})`);
      }
    }

    return tokens;
  }

  /**
   * Get Application Insights connection string.
   *
   * @returns {string|null} Connection string or null
   */
  getAppInsightsConnectionString() {
    return process.env.APPLICATIONINSIGHTS_CONNECTION_STRING || null;
  }
}

// Singleton
export const secretManager = new SecretManager();

// Convenience functions
export const getDatabaseConfig = () => secretManager.getDatabaseConfig();
export const getJwtConfig = () => secretManager.getJwtConfig();
export const getServiceTokens = () => secretManager.getServiceTokens();
export const getAppInsightsConnectionString = () => secretManager.getAppInsightsConnectionString();
