#!/bin/bash

# ============================================================================
# Azure Container Apps Deployment Script for User Service
# ============================================================================
# This script automates the deployment of User Service to Azure Container Apps
# with Dapr support for pub/sub messaging (RabbitMQ/Azure Service Bus).
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${BLUE}============================================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# ============================================================================
# Prerequisites Check
# ============================================================================
print_header "Checking Prerequisites"

# Check Azure CLI
if ! command -v az &> /dev/null; then
    print_error "Azure CLI is not installed. Please install it from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi
print_success "Azure CLI is installed"

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi
print_success "Docker is installed"

# Check if logged into Azure
if ! az account show &> /dev/null; then
    print_warning "Not logged into Azure. Initiating login..."
    az login
fi
print_success "Logged into Azure"

# ============================================================================
# User Input Collection
# ============================================================================
print_header "Azure Configuration"

# Function to prompt with default value
prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local varname="$3"
    
    read -p "$prompt [$default]: " input
    eval "$varname=\"${input:-$default}\""
}

# List available subscriptions
echo -e "\n${BLUE}Available Azure Subscriptions:${NC}"
az account list --query "[].{Name:name, SubscriptionId:id, IsDefault:isDefault}" --output table

echo ""
prompt_with_default "Enter Azure Subscription ID (leave empty for default)" "" SUBSCRIPTION_ID

if [ -n "$SUBSCRIPTION_ID" ]; then
    az account set --subscription "$SUBSCRIPTION_ID"
    print_success "Subscription set to: $SUBSCRIPTION_ID"
else
    SUBSCRIPTION_ID=$(az account show --query id --output tsv)
    print_info "Using default subscription: $SUBSCRIPTION_ID"
fi

# Resource Group
echo ""
prompt_with_default "Enter Resource Group name" "rg-xshopai-aca" RESOURCE_GROUP

# Location
echo ""
echo -e "${BLUE}Common Azure Locations:${NC}"
echo "  - swedencentral (Sweden Central)"
echo "  - eastus (East US)"
echo "  - westus2 (West US 2)"
echo "  - westeurope (West Europe)"
prompt_with_default "Enter Azure Location" "swedencentral" LOCATION

# Azure Container Registry
echo ""
prompt_with_default "Enter Azure Container Registry name" "acrxshopaiaca" ACR_NAME

# Container Apps Environment
echo ""
prompt_with_default "Enter Container Apps Environment name" "cae-xshopai-aca" ENVIRONMENT_NAME

# Cosmos DB Account Name (MongoDB API)
echo ""
prompt_with_default "Enter Cosmos DB Account name (MongoDB API)" "cosmos-xshopai-aca" COSMOS_ACCOUNT_NAME

# Service Bus Namespace (for Dapr pubsub)
echo ""
prompt_with_default "Enter Service Bus Namespace name" "sb-xshopai-aca" SERVICEBUS_NAMESPACE

# App name
APP_NAME="user-service"

# ============================================================================
# Confirmation
# ============================================================================
print_header "Deployment Configuration Summary"

echo "Resource Group:           $RESOURCE_GROUP"
echo "Location:                 $LOCATION"
echo "Container Registry:       $ACR_NAME"
echo "Environment:              $ENVIRONMENT_NAME"
echo "Cosmos DB Account:        $COSMOS_ACCOUNT_NAME"
echo "Service Bus Namespace:    $SERVICEBUS_NAMESPACE"
echo "App Name:                 $APP_NAME"
echo ""

read -p "Do you want to proceed with deployment? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    print_warning "Deployment cancelled by user"
    exit 0
fi

# ============================================================================
# Step 1: Create Resource Group (if needed)
# ============================================================================
print_header "Step 1: Verifying Resource Group"

if az group exists --name "$RESOURCE_GROUP" | grep -q "true"; then
    print_info "Resource group '$RESOURCE_GROUP' already exists"
else
    az group create \
        --name "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --output none
    print_success "Resource group '$RESOURCE_GROUP' created"
fi

# ============================================================================
# Step 2: Create Cosmos DB (MongoDB API) Account
# ============================================================================
print_header "Step 2: Setting Up Cosmos DB (MongoDB API)"

if az cosmosdb show --name "$COSMOS_ACCOUNT_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    print_info "Cosmos DB account '$COSMOS_ACCOUNT_NAME' already exists"
else
    print_info "Creating Cosmos DB account '$COSMOS_ACCOUNT_NAME' with MongoDB API..."
    print_warning "This may take 5-10 minutes. Please wait..."
    
    az cosmosdb create \
        --name "$COSMOS_ACCOUNT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --kind MongoDB \
        --server-version "4.2" \
        --default-consistency-level "Session" \
        --locations regionName="$LOCATION" failoverPriority=0 isZoneRedundant=false \
        --output none
    
    print_success "Cosmos DB account '$COSMOS_ACCOUNT_NAME' created"
fi

# Create user-service database
print_info "Creating user-service-db database..."
az cosmosdb mongodb database create \
    --account-name "$COSMOS_ACCOUNT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --name "user-service-db" \
    --output none 2>/dev/null || print_info "Database already exists"

# Get Cosmos DB connection string
print_info "Retrieving Cosmos DB connection details..."
MONGODB_CONNECTION_STRING=$(az cosmosdb keys list \
    --name "$COSMOS_ACCOUNT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --type connection-strings \
    --query "connectionStrings[0].connectionString" \
    --output tsv)

print_success "Cosmos DB connection string retrieved"

# ============================================================================
# Step 3: Create Azure Service Bus (for Dapr Pub/Sub)
# ============================================================================
print_header "Step 3: Setting Up Azure Service Bus"

if az servicebus namespace show --name "$SERVICEBUS_NAMESPACE" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    print_info "Service Bus namespace '$SERVICEBUS_NAMESPACE' already exists"
else
    print_info "Creating Service Bus namespace '$SERVICEBUS_NAMESPACE'..."
    
    az servicebus namespace create \
        --name "$SERVICEBUS_NAMESPACE" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --sku Standard \
        --output none
    
    print_success "Service Bus namespace '$SERVICEBUS_NAMESPACE' created"
fi

# Get Service Bus connection string
SERVICEBUS_CONNECTION_STRING=$(az servicebus namespace authorization-rule keys list \
    --resource-group "$RESOURCE_GROUP" \
    --namespace-name "$SERVICEBUS_NAMESPACE" \
    --name RootManageSharedAccessKey \
    --query primaryConnectionString \
    --output tsv)

print_success "Service Bus connection string retrieved"

# ============================================================================
# Step 4: Verify Azure Container Registry
# ============================================================================
print_header "Step 4: Verifying Azure Container Registry"

if az acr show --name "$ACR_NAME" &> /dev/null; then
    print_info "ACR '$ACR_NAME' already exists"
else
    az acr create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$ACR_NAME" \
        --sku Basic \
        --admin-enabled true \
        --output none
    print_success "ACR '$ACR_NAME' created"
fi

ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --query loginServer --output tsv)
print_info "ACR Login Server: $ACR_LOGIN_SERVER"

# ============================================================================
# Step 5: Build and Push Container Image
# ============================================================================
print_header "Step 5: Building and Pushing Container Image"

# Login to ACR
az acr login --name "$ACR_NAME"
print_success "Logged into ACR"

# Navigate to service directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_DIR="$(dirname "$SCRIPT_DIR")"

print_info "Building from: $SERVICE_DIR"
cd "$SERVICE_DIR"

# Build image
IMAGE_TAG="${ACR_LOGIN_SERVER}/${APP_NAME}:latest"
print_info "Building image: $IMAGE_TAG"

docker build -t "$IMAGE_TAG" .
print_success "Docker image built successfully"

# Push image
print_info "Pushing image to ACR..."
docker push "$IMAGE_TAG"
print_success "Docker image pushed to ACR"

# ============================================================================
# Step 6: Verify Container Apps Environment
# ============================================================================
print_header "Step 6: Verifying Container Apps Environment"

if az containerapp env show --name "$ENVIRONMENT_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    print_info "Container Apps Environment '$ENVIRONMENT_NAME' already exists"
else
    print_info "Creating Container Apps Environment '$ENVIRONMENT_NAME'..."
    
    az containerapp env create \
        --name "$ENVIRONMENT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --output none
    
    print_success "Container Apps Environment '$ENVIRONMENT_NAME' created"
fi

# ============================================================================
# Step 7: Configure Dapr Component for Pub/Sub
# ============================================================================
print_header "Step 7: Configuring Dapr Pub/Sub Component"

# Create Dapr component file in the project directory (for version control)
mkdir -p "$SERVICE_DIR/.dapr/components"

cat > "$SERVICE_DIR/.dapr/components/pubsub-aca.yaml" << EOF
componentType: pubsub.azure.servicebus.topics
version: v1
metadata:
  - name: connectionString
    secretRef: servicebus-connection-string
  - name: consumerID
    value: "user-service"
secrets:
  - name: servicebus-connection-string
    value: "${SERVICEBUS_CONNECTION_STRING}"
scopes:
  - user-service
  - auth-service
  - audit-service
  - notification-service
EOF

print_success "Dapr pubsub component file created at .dapr/components/pubsub-aca.yaml"

# Deploy the component to Azure Container Apps Environment
print_info "Deploying Dapr pubsub component to Container Apps Environment..."
az containerapp env dapr-component set \
    --name "user-pubsub" \
    --resource-group "$RESOURCE_GROUP" \
    --dapr-env-name "$ENVIRONMENT_NAME" \
    --yaml "$SERVICE_DIR/.dapr/components/pubsub-aca.yaml" \
    --output none

print_success "Dapr pubsub component configured in Azure"

# ============================================================================
# Step 8: Deploy Container App
# ============================================================================
print_header "Step 8: Deploying User Service Container App"

# Check if app already exists
if az containerapp show --name "$APP_NAME" --resource-group "$RESOURCE_GROUP" &> /dev/null; then
    print_info "Container app '$APP_NAME' already exists. Updating..."
    
    az containerapp update \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --image "$IMAGE_TAG" \
        --set-env-vars \
            "NODE_ENV=production" \
            "PORT=8002" \
            "MONGODB_URI=secretref:mongodb-connection-string" \
            "MONGODB_DB_NAME=user-service-db" \
            "DAPR_HTTP_PORT=3500" \
            "PUBSUB_NAME=user-pubsub" \
        --output none
    
    print_success "Container app updated"
else
    print_info "Creating new container app '$APP_NAME'..."
    
    az containerapp create \
        --name "$APP_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --environment "$ENVIRONMENT_NAME" \
        --image "$IMAGE_TAG" \
        --registry-server "$ACR_LOGIN_SERVER" \
        --target-port 8002 \
        --ingress internal \
        --min-replicas 1 \
        --max-replicas 5 \
        --cpu 0.5 \
        --memory 1Gi \
        --enable-dapr \
        --dapr-app-id "$APP_NAME" \
        --dapr-app-port 8002 \
        --dapr-app-protocol http \
        --secrets "mongodb-connection-string=${MONGODB_CONNECTION_STRING}" \
        --env-vars \
            "NODE_ENV=production" \
            "PORT=8002" \
            "MONGODB_URI=secretref:mongodb-connection-string" \
            "MONGODB_DB_NAME=user-service-db" \
            "DAPR_HTTP_PORT=3500" \
            "PUBSUB_NAME=user-pubsub" \
        --output none
    
    print_success "Container app created"
fi

# ============================================================================
# Step 9: Configure Scaling
# ============================================================================
print_header "Step 9: Configuring Auto-Scaling"

az containerapp update \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --min-replicas 1 \
    --max-replicas 5 \
    --output none

print_success "Auto-scaling configured (1-5 replicas)"

# ============================================================================
# Step 10: Verify Deployment
# ============================================================================
print_header "Step 10: Verifying Deployment"

# Get internal FQDN
INTERNAL_FQDN=$(az containerapp show \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.configuration.ingress.fqdn" \
    --output tsv)

print_info "Waiting for app to start..."
sleep 20

# Check app status
APP_STATUS=$(az containerapp show \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.runningStatus" \
    --output tsv)

if [ "$APP_STATUS" == "Running" ]; then
    print_success "User Service is running"
else
    print_warning "App status: $APP_STATUS (may still be starting)"
fi

# ============================================================================
# Deployment Summary
# ============================================================================
print_header "Deployment Complete!"

echo -e "${GREEN}User Service has been deployed successfully!${NC}\n"

echo -e "${YELLOW}Internal FQDN (accessed via Dapr service invocation):${NC}"
echo "  $INTERNAL_FQDN"
echo ""

echo -e "${YELLOW}Dapr App ID:${NC}"
echo "  user-service"
echo ""

echo -e "${YELLOW}Service Invocation from Web BFF:${NC}"
echo "  http://localhost:3500/v1.0/invoke/user-service/method/api/users"
echo ""

echo -e "${YELLOW}Published Events:${NC}"
echo "  - user.created"
echo "  - user.updated"
echo "  - user.deleted"
echo "  - user.logged_in"
echo "  - user.logged_out"
echo ""

echo -e "${YELLOW}Useful Commands:${NC}"
echo "  # View logs"
echo "  az containerapp logs show --name $APP_NAME --resource-group $RESOURCE_GROUP --type console --follow"
echo ""
echo "  # View Dapr sidecar logs"
echo "  az containerapp logs show --name $APP_NAME --resource-group $RESOURCE_GROUP --container daprd --follow"
echo ""
echo "  # View app details"
echo "  az containerapp show --name $APP_NAME --resource-group $RESOURCE_GROUP"
echo ""
echo "  # Update image"
echo "  az containerapp update --name $APP_NAME --resource-group $RESOURCE_GROUP --image ${ACR_LOGIN_SERVER}/${APP_NAME}:v2"
echo ""

echo -e "\n${CYAN}Note: User Service uses internal ingress and is accessed via Dapr service invocation from Web BFF.${NC}"
echo -e "${CYAN}MongoDB is provided by Cosmos DB with MongoDB API.${NC}"
echo -e "${CYAN}Events are published via Azure Service Bus through Dapr pub/sub.${NC}"
