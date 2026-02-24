import mongoose from 'mongoose';
import logger from '../core/logger.js';

const connectDB = async () => {
  try {
    // Get database configuration from environment variables
    let mongodb_uri = process.env.MONGODB_URI;

    if (!mongodb_uri) {
      throw new Error('MongoDB connection string not found. Set MONGODB_URI environment variable.');
    }

    // Force IPv4 by replacing 'localhost' with '127.0.0.1'
    mongodb_uri = mongodb_uri.replace('localhost', '127.0.0.1');

    // Check if this is Azure Cosmos DB
    const isCosmosDB = mongodb_uri.includes('cosmos.azure.com') || mongodb_uri.includes(':10255');

    // Parse URI for logging
    const dbName = process.env.MONGODB_DB_NAME || 'user_service_db';
    logger.info(`Connecting to MongoDB database: ${dbName}`);

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

    // Ensure indexes are created (required for Cosmos DB MongoDB API)
    // Mongoose autoIndex doesn't always work with Cosmos DB
    if (isCosmosDB) {
      try {
        const User = (await import('../models/user.model.js')).default;
        await User.createIndexes();
        logger.info('Database indexes synchronized for Cosmos DB');
      } catch (indexError) {
        // Log but don't fail - indexes might already exist
        logger.warn(`Index synchronization warning: ${indexError.message}`);
      }
    }

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
