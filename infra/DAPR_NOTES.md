# Dapr Configuration for Azure App Service

## ⚠️ Important Note

Azure App Service **does not have native Dapr support**. For production workloads using Dapr, consider migrating to **Azure Container Apps** which has built-in Dapr integration.

## Current Setup (App Service)

The user-service is configured to run **without Dapr** on Azure App Service. All service-to-service communication uses direct HTTP calls.

### What's Missing Without Dapr:
- ❌ Service-to-service invocation via Dapr
- ❌ Pub/sub messaging
- ❌ State management via Dapr
- ❌ Secrets management via Dapr

### What Still Works:
- ✅ Direct MongoDB connections
- ✅ Direct HTTP endpoints
- ✅ Environment variables from App Service
- ✅ Health checks and monitoring

## Option 1: Continue with App Service (Current)

**Pros:**
- Simple deployment
- Lower cost for single service
- Familiar Azure PaaS experience

**Cons:**
- No Dapr features
- Manual service discovery
- Need to handle retries, circuit breakers manually

**Configuration:**
Environment variables are set directly in App Service settings.

## Option 2: Migrate to Azure Container Apps (Recommended)

**Pros:**
- ✅ Native Dapr support
- ✅ Better for microservices
- ✅ Scale to zero
- ✅ Lower cost at scale
- ✅ Built-in service mesh

**Cons:**
- Requires containerization
- Different deployment model

### Migration Steps:

1. **Update Bicep for Container Apps:**
```bash
# I can create a new bicep template: infra/bicep/main-container-apps.bicep
```

2. **Add Dockerfile (already exists in repo)**

3. **Update GitHub Actions for container deployment**

4. **Configure Dapr components:**
   - State store (Azure Redis/Cosmos DB)
   - Pub/sub (Azure Service Bus)
   - Service invocation

### Estimated Cost Comparison:

**App Service (Current):**
- B1: ~$13/month
- P1v3: ~$124/month

**Container Apps:**
- Consumption plan: Pay per use, scale to zero
- ~$5-20/month for dev/staging
- ~$50-100/month for production (depending on load)

## Recommendation

For xShop.ai with multiple microservices, **migrate to Azure Container Apps** to fully utilize Dapr.

Would you like me to:
1. Create Container Apps Bicep templates?
2. Update workflows for container deployment?
3. Add Dapr component configurations?

## Quick Fix for Current Deployment

For now, the app will work without Dapr. To test:

```bash
# After deployment completes
curl https://user.azurewebsites.net/health
curl https://user.azurewebsites.net/api/users
```

The service will use direct MongoDB connections instead of Dapr state management.
