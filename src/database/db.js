import mongoose from 'mongoose';
import logger from '../core/logger.js';
import { getDatabaseConfig } from '../core/secretManager.js';

const connectDB = async () => {
  try {
    // Get database configuration from Dapr secret store
    const dbConfig = await getDatabaseConfig();

    // Force IPv4 by replacing 'localhost' with '127.0.0.1'
    const host = dbConfig.host === 'localhost' ? '127.0.0.1' : dbConfig.host;

    let mongodb_uri;
    // Check if this is Azure Cosmos DB (port 10255 or host contains cosmos)
    // Use String() conversion to handle both string and number port values
    const isCosmosDB = String(dbConfig.port) === '10255' || host.includes('cosmos.azure.com');
    
    // Log detection for debugging
    logger.info(`Database config - Host: ${host}, Port: ${dbConfig.port} (type: ${typeof dbConfig.port}), IsCosmosDB: ${isCosmosDB}`);
    
    // Cosmos DB requires ssl=true, replicaSet=globaldb, retryWrites=false, maxIdleTimeMS=120000
    const cosmosParams = 'ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000';
    
    if (dbConfig.username && dbConfig.password) {
      if (isCosmosDB) {
        mongodb_uri = `mongodb://${dbConfig.username}:${dbConfig.password}@${host}:${dbConfig.port}/${dbConfig.database}?authSource=${dbConfig.authSource}&${cosmosParams}`;
      } else {
        mongodb_uri = `mongodb://${dbConfig.username}:${dbConfig.password}@${host}:${dbConfig.port}/${dbConfig.database}?authSource=${dbConfig.authSource}`;
      }
    } else {
      if (isCosmosDB) {
        mongodb_uri = `mongodb://${host}:${dbConfig.port}/${dbConfig.database}?${cosmosParams}`;
      } else {
        mongodb_uri = `mongodb://${host}:${dbConfig.port}/${dbConfig.database}`;
      }
    }

    logger.info(`Connecting to MongoDB: ${host}:${dbConfig.port}/${dbConfig.database}`);

    // Set global promise library
    mongoose.Promise = global.Promise;

    // Set strictQuery to false to prepare for Mongoose 7
    mongoose.set('strictQuery', false);

    // Connect to MongoDB with connection options
    const connectionOptions = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 30000, // 30 seconds for cloud connections
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4
    };

    // Add TLS options for Cosmos DB
    if (isCosmosDB) {
      connectionOptions.tls = true;
      connectionOptions.retryWrites = false;
      logger.info('Using Cosmos DB connection settings (TLS enabled)');
    }

    const conn = await mongoose.connect(mongodb_uri, connectionOptions);

    logger.info(`MongoDB connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed due to application termination');
        process.exit(0);
      } catch (error) {
        logger.error(`Error during MongoDB disconnection: ${error.message}`);
        process.exit(1);
      }
    });

    return conn;
  } catch (error) {
    logger.error(`Error occurred while connecting to MongoDB: ${error.message}`);
    throw error;
  }
};

export default connectDB;
