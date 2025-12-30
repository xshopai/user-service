# Azure Deployment Setup

This guide explains how to set up GitHub Actions for automated deployment to Azure.

## Prerequisites

1. Azure subscription
2. GitHub repository
3. Azure CLI installed locally

## One-Time Setup

### 1. Create Service Principal

Run these commands in your terminal:

```bash
# Login to Azure
az login

# Set your subscription (if you have multiple)
az account set --subscription "YOUR_SUBSCRIPTION_NAME"

# Get your subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "Subscription ID: $SUBSCRIPTION_ID"

# Create service principal with Contributor role
az ad sp create-for-rbac \
  --name "gh-xshopai-user-service" \
  --role Contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID \
  --sdk-auth
```

This will output JSON credentials. **Save this output securely!**

### 2. Configure GitHub Secrets

Go to your GitHub repository: Settings → Secrets and variables → Actions → New repository secret

Add the following secrets from the service principal output:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `AZURE_CLIENT_ID` | `clientId` from JSON | `12345678-1234-1234-1234-123456789abc` |
| `AZURE_TENANT_ID` | `tenantId` from JSON | `87654321-4321-4321-4321-cba987654321` |
| `AZURE_SUBSCRIPTION_ID` | `subscriptionId` from JSON | `abcdef12-3456-7890-abcd-ef1234567890` |
| `JWT_SECRET` | Your JWT secret | `your-secure-random-string-here` |

### 3. Configure GitHub Environments (Optional but Recommended)

1. Go to Settings → Environments
2. Create two environments: `dev` and `prod`
3. For `prod`, add protection rules:
   - Required reviewers
   - Deployment branches: `main` only

## Deployment Workflows

### Infrastructure Deployment

**Workflow:** `.github/workflows/deploy-infra.yml`

**Triggers:**
- Manual: Actions → Deploy Infrastructure → Run workflow
- Automatic: Push to `main` with changes in `infra/**`

**What it does:**
1. Creates resource group
2. Deploys Cosmos DB
3. Creates App Service Plan
4. Creates App Service with Dapr enabled

### Application Deployment

**Workflow:** `.github/workflows/deploy-app.yml`

**Triggers:**
- Manual: Actions → Deploy Application → Run workflow
- Automatic: Push to `main` with changes in `src/**`

**What it does:**
1. Runs tests
2. Installs dependencies
3. Deploys code to App Service
4. Configures secrets
5. Performs health check

## Manual Deployment

If you prefer to deploy manually:

```bash
# Deploy infrastructure
az deployment group create \
  --resource-group xshopai \
  --template-file infra/bicep/main.bicep \
  --parameters infra/bicep/parameters.dev.json

# Deploy application
az webapp up \
  --name user \
  --resource-group xshopai \
  --runtime "NODE:24-lts"
```

## Monitoring Deployments

### View Logs
```bash
# Azure Portal
https://portal.azure.com → Resource Groups → xshopai → user (App Service) → Log stream

# Azure CLI
az webapp log tail --name user --resource-group xshopai
```

### Check Status
```bash
# Get App Service URL
az webapp show --name user --resource-group xshopai --query defaultHostName -o tsv

# Test endpoints
curl https://user.azurewebsites.net/health
curl https://user.azurewebsites.net/readiness
```

## Troubleshooting

### Deployment fails with "Invalid credentials"
- Verify GitHub secrets are correctly set
- Ensure service principal has Contributor role
- Check subscription ID matches your Azure subscription

### Application won't start
- Check logs: `az webapp log tail --name user --resource-group xshopai`
- Verify environment variables in Azure Portal
- Ensure Node.js version matches (24-lts)

### Health check fails
- Give service more time to start (increase sleep in workflow)
- Check if MongoDB connection is working
- Verify JWT_SECRET is set

### Cosmos DB connection issues
- Check firewall rules allow Azure services
- Verify connection string format
- Test connection locally first

## Security Best Practices

1. **Never commit secrets** to the repository
2. **Use Azure Key Vault** for production secrets
3. **Rotate service principal credentials** regularly
4. **Enable deployment protection** for production environment
5. **Review audit logs** for deployments

## Cost Management

Monitor costs in Azure Portal:
- Set up budget alerts
- Review resource utilization
- Scale down dev resources when not in use

## Next Steps

After successful deployment:

1. Configure custom domain
2. Set up Application Insights for monitoring
3. Enable auto-scaling
4. Configure backup and disaster recovery
5. Set up staging slots for zero-downtime deployments
