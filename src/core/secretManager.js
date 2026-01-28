/**
 * Secret Management Service
 * Provides secret management using Dapr's secret store building block.
 *
 * NOTE: Environment variables are loaded in server.js before this module is imported
 */

import { DaprClient } from '@dapr/dapr';
import logger from './logger.js';
import config from './config.js';

class SecretManager {
  constructor() {
    this.daprHost = config.dapr.host;
    this.daprPort = config.dapr.httpPort;
    // Standard Dapr component name for secret store
    this.secretStoreName = 'secretstore';

    logger.info('Secret manager initialized', {
      event: 'secret_manager_init',
      secretStore: this.secretStoreName,
    });
  }

  /**
   * Get a secret value from Dapr secret store
   *
   * Note: Secret names use hyphens (not underscores) for Azure Key Vault compatibility.
   * Both local secrets.json and Azure Key Vault use the same naming convention.
   *
   * @param {string} secretName - Name of the secret to retrieve (use hyphens, e.g., 'mongodb-host')
   * @returns {Promise<string|null>} Secret value or null if not found
   */
  async getSecret(secretName) {
    try {
      const client = new DaprClient({
        daprHost: this.daprHost,
        daprPort: this.daprPort,
      });

      const response = await client.secret.get(this.secretStoreName, secretName);

      // Dapr returns an object like { secretName: 'value' }
      if (response && secretName in response) {
        const value = response[secretName];
        logger.debug('Retrieved secret from Dapr', {
          event: 'secret_retrieved',
          secretName,
          source: 'dapr',
          store: this.secretStoreName,
        });
        return String(value);
      }

      logger.error('Secret not found in Dapr store', {
        event: 'secret_not_found',
        secretName,
        store: this.secretStoreName,
      });
      return null;
    } catch (error) {
      logger.error(`Failed to get secret from Dapr: ${error.message}`, {
        event: 'secret_retrieval_error',
        secretName,
        error: error.message,
        store: this.secretStoreName,
      });
      throw error;
    }
  }

  /**
   * Get database configuration from secrets or environment variables
   *
   * Priority order:
   * 1. DATABASE_URL from Dapr secret store (consistent with inventory-service)
   * 2. DATABASE_URL from environment variable (fallback for non-Dapr mode)
   *
   * DATABASE_URL format: mongodb://username:password@host:port/database?authSource=admin
   *
   * @returns {Promise<Object>} Database connection parameters
   */
  async getDatabaseConfig() {
    // Try Dapr secret store first (consistent with inventory-service pattern)
    try {
      const databaseUrl = await this.getSecret('DATABASE_URL');
      if (databaseUrl) {
        logger.info('Using DATABASE_URL from Dapr secret store');
        return this._parseDatabaseUrl(databaseUrl);
      }
    } catch (error) {
      logger.debug('DATABASE_URL not found in Dapr secret store, checking env var');
    }

    // Fallback to DATABASE_URL env var (non-Dapr local dev mode)
    const envDatabaseUrl = process.env.DATABASE_URL;
    if (envDatabaseUrl) {
      logger.info('Using DATABASE_URL from environment variable');
      return this._parseDatabaseUrl(envDatabaseUrl);
    }

    throw new Error('DATABASE_URL not found. Set it in Dapr secrets.json or as an environment variable.');
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
        host: parsed.hostname || '127.0.0.1',
        port: parseInt(parsed.port || '27018', 10),
        username: parsed.username || '',
        password: parsed.password || '',
        database: parsed.pathname.replace('/', '') || 'user_service_db',
        authSource,
      };
    } catch (error) {
      logger.error(`Invalid DATABASE_URL format: ${error.message}`);
      throw new Error('Invalid DATABASE_URL format. Expected: mongodb://user:pass@host:port/database?authSource=admin');
    }
  }

  /**
   * Get JWT configuration from secrets
   * Only JWT_SECRET is truly secret - algorithm and expiration are just config.
   *
   * @returns {Promise<Object>} JWT configuration parameters
   */
  async getJwtConfig() {
    const secret = await this.getSecret('JWT_SECRET');

    return {
      secret: secret || 'default-secret-key',
      algorithm: process.env.JWT_ALGORITHM || 'HS256',
      expiration: process.env.JWT_EXPIRATION || '3600',
      issuer: process.env.JWT_ISSUER || 'auth-service',
      audience: process.env.JWT_AUDIENCE || 'xshopai-platform',
    };
  }
}

// Global instance
export const secretManager = new SecretManager();

// Helper functions for easy access
export const getDatabaseConfig = () => secretManager.getDatabaseConfig();
export const getJwtConfig = () => secretManager.getJwtConfig();
