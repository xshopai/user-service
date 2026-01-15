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
    // Component name is configurable - defaults to 'secret-store' for local dev
    this.secretStoreName = process.env.DAPR_SECRET_STORE_NAME || 'secret-store';

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
   * Note: Secret names use hyphens (not underscores) for Azure Key Vault compatibility.
   * Both local secrets.json and Azure Key Vault use the same naming convention.
   * 
   * @returns {Promise<Object>} Database connection parameters
   */
  async getDatabaseConfig() {
    const [host, port, username, password, database, authSource] = await Promise.all([
      this.getSecret('mongodb-host'),
      this.getSecret('mongodb-port'),
      this.getSecret('mongo-initdb-root-username'),
      this.getSecret('mongo-initdb-root-password'),
      this.getSecret('mongo-initdb-database'),
      this.getSecret('mongodb-auth-source'),
    ]);

    return {
      host: host || '127.0.0.1',
      port: parseInt(port || '27018', 10),
      username: username || 'admin',
      password: password || 'admin123',
      database: database || 'user_service_db',
      authSource: authSource || 'admin',
    };
  }

  /**
   * Get JWT configuration from secrets
   * Only jwt-secret is truly secret - algorithm and expiration are just config.
   * 
   * Note: Secret names use hyphens (not underscores) for Azure Key Vault compatibility.
   * 
   * @returns {Promise<Object>} JWT configuration parameters
   */
  async getJwtConfig() {
    const secret = await this.getSecret('jwt-secret');

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
