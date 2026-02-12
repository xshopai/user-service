/**
 * Server Bootstrap
 * Loads environment variables BEFORE importing app modules
 * This prevents module initialization race conditions with dotenv
 */

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

// Initialize tracing AFTER dotenv loads (dynamic import to avoid hoisting)
await import('./tracing.js');

// Dynamic import to ensure env vars are loaded first
const { default: validateConfig } = await import('./validators/config.validator.js');

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
