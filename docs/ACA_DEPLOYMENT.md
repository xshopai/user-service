# Azure Container Apps Deployment Guide

This guide provides step-by-step instructions for deploying the User Service to **Azure Container Apps** with built-in Dapr support.

---

## Prerequisites

- **Azure CLI** installed - [Install Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- **Azure Subscription** with appropriate permissions
- **Docker** installed for building container images
- **Azure Container Registry** (or Docker Hub account)

---

## Step-by-Step Deployment

### Step 1: Login to Azure

```bash
# Login to Azure
az login

# Set subscription (if you have multiple)
az account set --subscription "<subscription-id>"

# Verify current subscription
az account show
```

### Step 2: Create Resource Group

```bash
# Set variables (shared across all xshopai services)
RESOURCE_GROUP="rg-xshopai-aca"
LOCATION="swedencentral"

# Create resource group (skip if already exists for other services)
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION
```

> **Note**: This resource group and all resources within it are specific to Azure Container Apps deployment. For AKS deployment, use `rg-xshopai-aks` with separate resources.

### Step 3: Create Azure Container Registry

```bash
# Set ACR name (ACA-specific, must be globally unique)
ACR_NAME="acrxshopaiaca"

# Create container registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show --name $ACR_NAME --query loginServer --output tsv)
echo "ACR Login Server: $ACR_LOGIN_SERVER"
```

### Step 4: Build and Push Container Image

```bash
# Login to ACR
az acr login --name $ACR_NAME

# Build Docker image
docker build -t user-service:latest .

# Tag image for ACR
docker tag user-service:latest $ACR_LOGIN_SERVER/user-service:latest

# Push to ACR
docker push $ACR_LOGIN_SERVER/user-service:latest

# Verify image was pushed
az acr repository list --name $ACR_NAME --output table
```

### Step 5: Register Resource Providers

```bash
# Register required resource providers (one-time per subscription)
az provider register --namespace microsoft.operationalinsights --wait
az provider register --namespace microsoft.insights --wait
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.ServiceBus --wait

# Verify registration status
az provider show --namespace microsoft.operationalinsights --query "registrationState" --output tsv
az provider show --namespace microsoft.insights --query "registrationState" --output tsv
```

> **Note**: Provider registration can take 1-2 minutes. The `--wait` flag ensures the command waits for registration to complete.

### Step 6: Create Application Insights

```bash
# Create Application Insights (ACA-specific)
AI_NAME="ai-xshopai-aca"

az monitor app-insights component create \
  --app $AI_NAME \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP

# Get instrumentation key (needed for Container Apps Environment)
AI_KEY=$(az monitor app-insights component show \
  --app $AI_NAME \
  --resource-group $RESOURCE_GROUP \
  --query instrumentationKey \
  --output tsv)

echo "App Insights Key: $AI_KEY"
```

### Step 7: Create Container Apps Environment

```bash
# Set environment name (ACA-specific)
ENVIRONMENT_NAME="cae-xshopai-aca"

# Create Container Apps environment with Dapr enabled
az containerapp env create \
  --name $ENVIRONMENT_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --dapr-instrumentation-key $AI_KEY \
  --enable-workload-profiles false
```

### Step 8: Create Azure Service Bus (for messaging)

```bash
# Set Service Bus namespace (ACA-specific)
SB_NAMESPACE="sb-xshopai-aca"

# Create Service Bus namespace
az servicebus namespace create \
  --name $SB_NAMESPACE \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard

# Create topic for user events
az servicebus topic create \
  --name user-events \
  --namespace-name $SB_NAMESPACE \
  --resource-group $RESOURCE_GROUP

# Get connection string
SB_CONNECTION=$(az servicebus namespace authorization-rule keys list \
  --namespace-name $SB_NAMESPACE \
  --resource-group $RESOURCE_GROUP \
  --name RootManageSharedAccessKey \
  --query primaryConnectionString \
  --output tsv)
```

### Step 9: Create Azure Cosmos DB (MongoDB API)

```bash
# Set Cosmos DB account name (ACA-specific)
COSMOS_ACCOUNT="cosmos-xshopai-aca"
DB_NAME="user_service_db"

# Create Cosmos DB account with MongoDB API
az cosmosdb create \
  --resource-group $RESOURCE_GROUP \
  --name $COSMOS_ACCOUNT \
  --kind MongoDB \
  --server-version 4.2 \
  --default-consistency-level Session \
  --locations regionName=$LOCATION failoverPriority=0 isZoneRedundant=false

# Create database
az cosmosdb mongodb database create \
  --resource-group $RESOURCE_GROUP \
  --account-name $COSMOS_ACCOUNT \
  --name $DB_NAME

# Get connection string
COSMOS_CONNECTION=$(az cosmosdb keys list \
  --resource-group $RESOURCE_GROUP \
  --name $COSMOS_ACCOUNT \
  --type connection-strings \
  --query connectionStrings[0].connectionString \
  --output tsv)
```

### Step 10: Create Dapr Component for Azure Service Bus

The local `.dapr/components/event-bus.yaml` is configured for RabbitMQ. For Azure Container Apps, create an Azure Service Bus component in the same folder:

```bash
# Create Azure Service Bus component file in .dapr/components folder
cat > .dapr/components/dapr-servicebus-component.yaml << EOF
componentType: pubsub.azure.servicebus.topics
version: v1
metadata:
  - name: connectionString
    value: '$SB_CONNECTION'
  - name: consumerID
    value: user-service
scopes:
  - user-service
EOF

# Verify the file
cat .dapr/components/dapr-servicebus-component.yaml
```

> **Note**:
>
> - Local development uses RabbitMQ (`.dapr/components/event-bus.yaml`)
> - Azure Container Apps uses Azure Service Bus (`.dapr/components/dapr-servicebus-component.yaml`)
> - The `$SB_CONNECTION` variable was set in Step 8

### Step 11: Deploy Container App

```bash
# Set app name
APP_NAME="user-service"

# Get ACR credentials
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query passwords[0].value --output tsv)

# Create container app
az containerapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $ENVIRONMENT_NAME \
  --image $ACR_LOGIN_SERVER/user-service:latest \
  --registry-server $ACR_LOGIN_SERVER \
  --registry-username $ACR_NAME \
  --registry-password $ACR_PASSWORD \
  --target-port 8002 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 5 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --enable-dapr \
  --dapr-app-id user-service \
  --dapr-app-port 8002 \
  --env-vars \
    "NODE_ENV=production" \
    "MONGODB_URI=$COSMOS_CONNECTION" \
    "MESSAGING_PROVIDER=dapr" \
    "DAPR_PUBSUB_NAME=user-pubsub"
```

### Step 12: Configure Dapr Component in Container Apps

```bash
# Create Dapr pub/sub component (using the file created in Step 10)
az containerapp env dapr-component set \
  --name $ENVIRONMENT_NAME \
  --resource-group $RESOURCE_GROUP \
  --dapr-component-name user-pubsub \
  --yaml .dapr/components/dapr-servicebus-component.yaml
```

### Step 13: Verify Deployment

```bash
# Check app status
az containerapp show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.runningStatus

# Get application URL
APP_URL=$(az containerapp show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

echo "Application URL: https://$APP_URL"

# Test health endpoint
curl https://$APP_URL/health
```

---

## Configure Secrets (Production)

### Using Azure Key Vault

```bash
# Create Key Vault (ACA-specific)
KV_NAME="kv-xshopai-aca"

az keyvault create \
  --name $KV_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Store secrets
az keyvault secret set --vault-name $KV_NAME --name "mongodb-uri" --value "$COSMOS_CONNECTION"
az keyvault secret set --vault-name $KV_NAME --name "jwt-secret" --value "<jwt-secret>"

# Grant Container App access to Key Vault
# Enable managed identity first
az containerapp identity assign \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --system-assigned

# Get principal ID
PRINCIPAL_ID=$(az containerapp identity show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query principalId \
  --output tsv)

# Grant Key Vault access
az keyvault set-policy \
  --name $KV_NAME \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list
```

---

## Monitoring and Observability

### View Application Logs

```bash
# Stream logs
az containerapp logs show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --follow

# View Dapr sidecar logs
az containerapp logs show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --container daprd \
  --follow
```

### Application Insights Integration

Application Insights was created in Step 6. To add it to the container app's environment variables:

```bash
# Update container app with App Insights connection string
az containerapp update \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars "APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=$AI_KEY"
```

---

## Cleanup Resources

```bash
# Delete container app (safe - only removes user-service)
az containerapp delete \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --yes

# Delete entire ACA deployment (all xshopai services in ACA)
# az group delete --name $RESOURCE_GROUP --yes
```
