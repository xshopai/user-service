/**
 * Secret Manager Utility
 * Manages secrets retrieval using Dapr Secret Store building block
 *
 * Naming Convention:
 * - Application code uses UPPER_SNAKE_CASE environment variables
 * - Local dev (.env, .dapr/secrets.json) uses UPPER_SNAKE_CASE
 * - Azure Key Vault uses lower-kebab-case (aca.sh translates at deployment time)
 *
 * User Service Required Secrets:
 * - COSMOS_ACCOUNT_CONNECTION : Cosmos DB (MongoDB API) connection string
 * - JWT_SECRET                : JWT signing secret
 * - APPINSIGHTS_CONNECTION    : Application Insights connection string
 * - SERVICE_AUTH_TOKEN        : Auth service token
 * - SERVICE_ADMIN_TOKEN       : Admin service token
 * - SERVICE_ORDER_TOKEN       : Order service token
 * - SERVICE_WEBBFF_TOKEN      : Web BFF token
 */

import { DaprClient } from '@dapr/dapr';
import logger from './logger.js';
import config from './config.js';

class SecretManager {
  constructor() {
    this.daprHost = config.dapr.host;
    this.daprPort = config.dapr.httpPort;
    this.secretStoreName = 'secretstore';
    this._cache = {};

    logger.info('Secret manager initialized', {
      event: 'secret_manager_init',
      secretStore: this.secretStoreName,
    });
  }

  /**
   * Get a secret value (UPPER_SNAKE_CASE key).
   * Tries Dapr first, falls back to env var.
   *
   * @param {string} key - Secret key (e.g., 'JWT_SECRET')
   * @returns {Promise<string|null>} Secret value or null if not found
   */
  async getSecret(key) {
    // Check cache
    if (this._cache[key]) {
      return this._cache[key];
    }

    let value = null;

    // Try Dapr Secret Store first
    try {
      const client = new DaprClient({
        daprHost: this.daprHost,
        daprPort: this.daprPort,
      });

      const response = await client.secret.get(this.secretStoreName, key);

      if (response && key in response) {
        value = String(response[key]);
        logger.debug(`Secret '${key}' loaded from Dapr`);
      }
    } catch (error) {
      logger.debug(`Dapr lookup failed for '${key}': ${error.message}`);
    }

    // Fallback to environment variable
    if (!value) {
      value = process.env[key];
      if (value) {
        logger.debug(`Secret '${key}' loaded from env`);
      }
    }

    if (value) {
      this._cache[key] = value;
      return value;
    }

    return null;
  }

  /**
   * Get MongoDB database configuration.
   *
   * @returns {Promise<Object>} Database connection parameters
   */
  async getDatabaseConfig() {
    // Try MONGODB_URI first (set by aca.sh)
    let uri = process.env.MONGODB_URI;

    // Fall back to COSMOS_ACCOUNT_CONNECTION via Dapr
    if (!uri) {
      uri = await this.getSecret('COSMOS_ACCOUNT_CONNECTION');
    }

    if (!uri) {
      throw new Error(
        'MongoDB connection string not found. ' +
        'Set MONGODB_URI env var or COSMOS_ACCOUNT_CONNECTION in Dapr secret store.'
      );
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
   * @returns {Promise<Object>} JWT configuration parameters
   */
  async getJwtConfig() {
    let secret = process.env.JWT_SECRET || await this.getSecret('JWT_SECRET');

    if (!secret) {
      logger.warn('JWT secret not found, using default (NOT SECURE)');
      secret = 'default-secret-key';
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
   * @returns {Promise<Object>} Service tokens
   */
  async getServiceTokens() {
    const tokenKeys = {
      'auth-service': 'SERVICE_AUTH_TOKEN',
      'admin-service': 'SERVICE_ADMIN_TOKEN',
      'order-service': 'SERVICE_ORDER_TOKEN',
      'web-bff': 'SERVICE_WEBBFF_TOKEN',
    };

    const tokens = {};
    for (const [service, key] of Object.entries(tokenKeys)) {
      const value = process.env[key] || await this.getSecret(key);
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
   * @returns {Promise<string|null>} Connection string or null
   */
  async getAppInsightsConnectionString() {
    // Check standard Azure SDK env var first
    const connString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    if (connString) {
      return connString;
    }

    // Fall back to Dapr secretstore / env var
    return this.getSecret('APPINSIGHTS_CONNECTION');
  }
}

// Singleton
export const secretManager = new SecretManager();

// Convenience functions
export const getDatabaseConfig = () => secretManager.getDatabaseConfig();
export const getJwtConfig = () => secretManager.getJwtConfig();
export const getServiceTokens = () => secretManager.getServiceTokens();
export const getAppInsightsConnectionString = () => secretManager.getAppInsightsConnectionString();
