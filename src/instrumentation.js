/**
 * Application Insights instrumentation for user-service
 *
 * IMPORTANT: This file must be imported AFTER dotenv.config() but BEFORE
 * any other imports to ensure all HTTP requests and dependencies are tracked.
 */

const serviceName = process.env.SERVICE_NAME || 'user-service';

// Set OTEL environment variables BEFORE loading applicationinsights
// (OpenTelemetry reads these before our code can set cloud role name)
process.env.OTEL_SERVICE_NAME = serviceName;
process.env.OTEL_RESOURCE_ATTRIBUTES = `service.name=${serviceName}`;

// Dynamic import to ensure OTEL env vars are set before module loads
const appInsights = await import('applicationinsights').then((m) => m.default);

const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

if (connectionString) {
  appInsights
    .setup(connectionString)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true, true)
    .setUseDiskRetryCaching(true)
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
    .setSendLiveMetrics(true);

  // Set cloud role name BEFORE starting (required for Application Map)
  appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] = serviceName;
  appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRoleInstance] =
    process.env.HOSTNAME || serviceName;

  appInsights.start();

  console.log(`✅ Application Insights initialized for ${serviceName}`);
} else {
  console.log('⚠️ APPLICATIONINSIGHTS_CONNECTION_STRING not set - telemetry disabled');
}

export default appInsights;
