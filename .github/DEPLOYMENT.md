# Azure Deployment Setup

This guide explains how to set up GitHub Actions for automated deployment to Azure.

## Prerequisites

1. Azure subscription
2. GitHub repository
3. Azure CLI installed locally

## One-Time Setup

### 1. Create Service Principal with Federated Credentials

Run these commands in your terminal:

```bash
# Login to Azure
az login

# Set your subscription (if you have multiple)
az account set --subscription "YOUR_SUBSCRIPTION_NAME"

# Get your subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "Subscription ID: $SUBSCRIPTION_ID"

# Create service principal
APP_ID=$(az ad sp create-for-rbac \
  --name "gh-xshopai-user-service" \
  --role Contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID \
  --query appId -o tsv)

echo "Application (Client) ID: $APP_ID"

# Get Object ID
OBJECT_ID=$(az ad sp show --id $APP_ID --query id -o tsv)
echo "Object ID: $OBJECT_ID"

# Get Tenant ID
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "Tenant ID: $TENANT_ID"

# Create federated credential for dev environment
az ad app federated-credential create \
  --id $APP_ID \
  --parameters "{
    \"name\": \"gh-xshopai-user-service-dev\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:xshopai/user-service:environment:dev\",
    \"audiences\": [\"api://AzureADTokenExchange\"],
    \"description\": \"GitHub Actions - user-service - dev environment\"
  }"

# Create federated credential for prod environment
az ad app federated-credential create \
  --id $APP_ID \
  --parameters "{
    \"name\": \"gh-xshopai-user-service-prod\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:xshopai/user-service:environment:prod\",
    \"audiences\": [\"api://AzureADTokenExchange\"],
    \"description\": \"GitHub Actions - user-service - prod environment\"
  }"

# Create federated credential for main branch (no environment)
az ad app federated-credential create \
  --id $APP_ID \
  --parameters "{
    \"name\": \"gh-xshopai-user-service-main\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:xshopai/user-service:ref:refs/heads/main\",
    \"audiences\": [\"api://AzureADTokenExchange\"],
    \"description\": \"GitHub Actions - user-service - main branch\"
  }"

echo ""
echo "=== Copy these values to GitHub Secrets ==="
echo "AZURE_CLIENT_ID: $APP_ID"
echo "AZURE_TENANT_ID: $TENANT_ID"
echo "AZURE_SUBSCRIPTION_ID: $SUBSCRIPTION_ID"
```

**Important:** Save the output values - you'll need them for GitHub Secrets!

### 2. Configure GitHub Secrets

Go to your GitHub repository: Settings → Secrets and variables → Actions → New repository secret

Add the following secrets from the service principal setup:

| Secret Name | Value | Where to Find |
|-------------|-------|---------------|
| `AZURE_CLIENT_ID` | Application (Client) ID | Output from setup script |
| `AZURE_TENANT_ID` | Tenant ID | Output from setup script |
| `AZURE_SUBSCRIPTION_ID` | Subscription ID | Output from setup script |
| `JWT_SECRET` | Your JWT secret | Generate: `openssl rand -base64 32` |

**Note:** With federated credentials, you don't need a client secret in GitHub!

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
