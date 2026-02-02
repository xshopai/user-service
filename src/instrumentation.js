/**
 * Azure Monitor OpenTelemetry instrumentation for user-service
 *
 * IMPORTANT: This file must be imported AFTER dotenv.config() but BEFORE
 * any other imports to ensure all HTTP requests and dependencies are tracked.
 *
 * Uses @azure/monitor-opentelemetry (same as Python services) for consistent
 * telemetry reporting, especially for MongoDB dependency tracking (hostname vs IP).
 */

const serviceName = process.env.SERVICE_NAME || 'user-service';

// Set OTEL environment variables BEFORE loading Azure Monitor
process.env.OTEL_SERVICE_NAME = serviceName;
process.env.OTEL_RESOURCE_ATTRIBUTES = `service.name=${serviceName}`;

const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

let azureMonitorEnabled = false;

if (connectionString) {
  try {
    // Import Azure Monitor OpenTelemetry
    const { useAzureMonitor } = await import('@azure/monitor-opentelemetry');

    // Configure Azure Monitor with explicit MongoDB instrumentation
    useAzureMonitor({
      azureMonitorExporterOptions: {
        connectionString: connectionString,
      },
      instrumentationOptions: {
        // Enable all auto-instrumentations
        http: { enabled: true },
        mongodb: { enabled: true }, // This captures hostname instead of IP
        mongoose: { enabled: true },
        express: { enabled: true },
      },
      // Enable live metrics
      enableLiveMetrics: true,
      // Enable standard metrics
      enableStandardMetrics: true,
    });

    azureMonitorEnabled = true;
    console.log(`✅ Azure Monitor OpenTelemetry initialized for ${serviceName}`);
  } catch (error) {
    console.error(`❌ Failed to initialize Azure Monitor: ${error.message}`);
  }
} else {
  console.log('⚠️ APPLICATIONINSIGHTS_CONNECTION_STRING not set - telemetry disabled');
}

export { azureMonitorEnabled };
export default { enabled: azureMonitorEnabled };
