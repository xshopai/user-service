# User Service - Azure Infrastructure

This directory contains the Infrastructure as Code (IaC) for deploying the user-service to Azure.

## Structure

```
infra/
└── bicep/
    ├── main.bicep              # Main infrastructure template
    ├── parameters.dev.json     # Development environment parameters
    └── parameters.prod.json    # Production environment parameters
```

## Resources Created

- **Cosmos DB Account** (MongoDB API): Shared database account
- **MongoDB Database**: `userdb`
- **MongoDB Collection**: `users` (with email unique index)
- **App Service Plan**: Linux-based plan for Node.js
- **App Service**: Node.js 24 app with Dapr enabled
- **Dapr Configuration**: Sidecar enabled with pub/sub support

## Prerequisites

1. Azure CLI installed and authenticated
2. Resource group created: `xshopai`
3. Appropriate permissions to create resources

## Deployment

### Using Azure CLI

```bash
# Create resource group (one-time)
az group create --name xshopai --location eastus

# Deploy infrastructure (dev)
az deployment group create \
  --resource-group xshopai \
  --template-file infra/bicep/main.bicep \
  --parameters infra/bicep/parameters.dev.json

# Deploy infrastructure (prod)
az deployment group create \
  --resource-group xshopai \
  --template-file infra/bicep/main.bicep \
  --parameters infra/bicep/parameters.prod.json
```

### Using GitHub Actions

Deployment is automated via GitHub Actions. See `.github/workflows/deploy-infra.yml`

## Configuration

### Environment Parameters

**Development (parameters.dev.json):**
- Location: East US
- App Service SKU: B1 (Basic)
- Cosmos DB: Free tier enabled
- Throughput: 400 RU/s

**Production (parameters.prod.json):**
- Location: East US
- App Service SKU: P1v3 (Premium)
- Cosmos DB: Standard tier
- Throughput: 1000 RU/s

### Environment Variables

The following environment variables are automatically configured:

- `NODE_ENV`: production/development
- `PORT`: 1002
- `MONGODB_URI`: Cosmos DB connection string
- `DAPR_HOST`: localhost
- `DAPR_HTTP_PORT`: 3500
- `DAPR_GRPC_PORT`: 50001
- `DAPR_APP_ID`: user-service

**Secrets (managed via Key Vault or GitHub Secrets):**
- `JWT_SECRET`: JWT signing secret

## Outputs

After deployment, the following values are available:

- `appServiceName`: Name of the created App Service
- `appServiceUrl`: Public URL of the service
- `cosmosDbAccountName`: Cosmos DB account name
- `cosmosDbConnectionString`: Database connection string

## Cost Estimation

**Development:**
- Cosmos DB: Free tier (first 1000 RU/s free)
- App Service B1: ~$13/month

**Production:**
- Cosmos DB: ~$24/month (1000 RU/s)
- App Service P1v3: ~$124/month

## Next Steps

After infrastructure is deployed:

1. Deploy the application code (see `.github/workflows/deploy-app.yml`)
2. Configure custom domain (optional)
3. Set up monitoring and alerts
4. Configure backup and disaster recovery

## Troubleshooting

**Deployment fails with "Resource already exists":**
- Cosmos DB accounts have globally unique names
- Change `cosmosDbAccountName` parameter

**App Service won't start:**
- Check environment variables in Azure Portal
- Review App Service logs: `az webapp log tail --name user --resource-group xshopai`

**Dapr not working:**
- Verify Dapr extension is enabled: Check App Service > Configuration > Dapr
- Ensure `daprConfig` section is present in deployment

## Clean Up

To delete all resources:

```bash
az group delete --name xshopai --yes --no-wait
```
