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
    // Azure Container Apps uses 'secretstore' (no hyphen)
    this.secretStoreName = process.env.DAPR_SECRET_STORE_NAME || 'secret-store';

    logger.info('Secret manager initialized', {
      event: 'secret_manager_init',
      secretStore: this.secretStoreName,
    });
  }

  /**
   * Get a secret value from Dapr secret store
   * @param {string} secretName - Name of the secret to retrieve
   * @returns {Promise<string|null>} Secret value or null if not found
   */
  async getSecret(secretName) {
    try {
      const client = new DaprClient({
        daprHost: this.daprHost,
        daprPort: this.daprPort,
      });

      // Azure Key Vault doesn't support underscores in secret names
      // Convert underscores to hyphens for Key Vault compatibility
      const keyVaultSecretName = secretName.replace(/_/g, '-');

      const response = await client.secret.get(this.secretStoreName, keyVaultSecretName);

      // Dapr returns an object like { secretName: 'value' }
      // Use the Key Vault secret name (with hyphens) to access the response
      if (response && keyVaultSecretName in response) {
        const value = response[keyVaultSecretName];
        logger.debug('Retrieved secret from Dapr', {
          event: 'secret_retrieved',
          secretName,
          keyVaultSecretName,
          source: 'dapr',
          store: this.secretStoreName,
        });
        return String(value);
      }

      logger.error('Secret not found in Dapr store', {
        event: 'secret_not_found',
        secretName,
        keyVaultSecretName,
        store: this.secretStoreName,
      });
      return null;
    } catch (error) {
      logger.error(`Failed to get secret from Dapr: ${error.message}`, {
        event: 'secret_retrieval_error',
        secretName,
        keyVaultSecretName: secretName.replace(/_/g, '-'),
        error: error.message,
        store: this.secretStoreName,
      });
      throw error;
    }
  }

  /**
   * Get database configuration from secrets or environment variables
   * @returns {Promise<Object>} Database connection parameters
   */
  async getDatabaseConfig() {
    const [host, port, username, password, database, authSource] = await Promise.all([
      this.getSecret('MONGODB_HOST'),
      this.getSecret('MONGODB_PORT'),
      this.getSecret('MONGO_INITDB_ROOT_USERNAME'),
      this.getSecret('MONGO_INITDB_ROOT_PASSWORD'),
      this.getSecret('MONGO_INITDB_DATABASE'),
      this.getSecret('MONGODB_AUTH_SOURCE'),
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
   * Only JWT_SECRET is truly secret - algorithm and expiration are just config.
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
