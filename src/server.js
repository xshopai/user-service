/**
 * Server Bootstrap
 * Loads environment variables BEFORE importing app modules
 * This prevents module initialization race conditions with dotenv
 */

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

// Initialize Application Insights AFTER dotenv but BEFORE other imports
import './instrumentation.js';

import validateConfig from './validators/config.validator.js';

async function startServer() {
  try {
    // Validate configuration (blocking - must pass)
    validateConfig();

    // Start the application (imports app.js after env vars are loaded)
    await import('./app.js');
  } catch (error) {
    console.error('❌ Failed to start user service:', error.message);
    process.exit(1);
  }
}

startServer();
