/**
 * Configuration module for user-service
 * Centralizes all environment-based configuration (non-sensitive only)
 *
 * For sensitive secrets (database credentials, JWT secrets), use:
 * - import { getDatabaseConfig, getJwtConfig } from '../clients/index.js'
 */

export default {
  service: {
    name: process.env.SERVICE_NAME || 'user-service',
    version: process.env.VERSION || '1.0.0',
    port: parseInt(process.env.PORT, 10) || 8002,
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
  },

  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    format: process.env.LOG_FORMAT || 'console',
    toConsole: process.env.LOG_TO_CONSOLE === 'true',
    toFile: process.env.LOG_TO_FILE === 'true',
    filePath: process.env.LOG_FILE_PATH || './logs/user-service.log',
  },

  dapr: {
    httpPort: parseInt(process.env.DAPR_HTTP_PORT, 10) || 3500,
    grpcPort: parseInt(process.env.DAPR_GRPC_PORT, 10) || 50001,
    host: process.env.DAPR_HOST || 'localhost',
    pubsubName: 'pubsub',
    appId: process.env.DAPR_APP_ID || 'user-service',
  },
};
