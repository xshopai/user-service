# ============================================================================
# Azure Container Apps Deployment Script for User Service (PowerShell)
# ============================================================================
# This script deploys the User Service to Azure Container Apps.
# 
# PREREQUISITE: Run the infrastructure deployment script first:
#   cd infrastructure/azure/aca/scripts
#   ./deploy-infra.ps1
#
# The infrastructure script creates all shared resources:
#   - Resource Group, ACR, Container Apps Environment
#   - Service Bus, Redis, Cosmos DB, MySQL, Key Vault
#   - Dapr components (pubsub, statestore, secretstore)
# ============================================================================

$ErrorActionPreference = "Stop"

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------
function Write-Header { 
    param([string]$Message)
    Write-Host "`n==============================================================================" -ForegroundColor Blue
    Write-Host $Message -ForegroundColor Blue
    Write-Host "==============================================================================`n" -ForegroundColor Blue
}

function Write-Success { param([string]$Message); Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message); Write-Host "⚠ $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message); Write-Host "✗ $Message" -ForegroundColor Red }
function Write-Info { param([string]$Message); Write-Host "ℹ $Message" -ForegroundColor Cyan }

function Read-HostWithDefault { 
    param([string]$Prompt, [string]$Default)
    $input = Read-Host "$Prompt [$Default]"
    if ([string]::IsNullOrWhiteSpace($input)) { return $Default }
    return $input
}

# ============================================================================
# Prerequisites Check
# ============================================================================
Write-Header "Checking Prerequisites"

try { az version | Out-Null; Write-Success "Azure CLI installed" } 
catch { Write-Error "Azure CLI not installed"; exit 1 }

try { docker version | Out-Null; Write-Success "Docker installed" } 
catch { Write-Error "Docker not installed"; exit 1 }

try { az account show | Out-Null; Write-Success "Logged into Azure" } 
catch { Write-Warning "Not logged into Azure. Initiating login..."; az login }

# ============================================================================
# Configuration
# ============================================================================
Write-Header "Configuration"

# Service-specific configuration
$ServiceName = "user-service"
$ServiceVersion = "1.0.0"
$AppPort = 8002
$ProjectName = "xshopai"

# Dapr configuration (standard ports - same for local dev and ACA)
$DaprHttpPort = 3500
$DaprPubsubName = "pubsub"

# Get script directory and service directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServiceDir = Split-Path -Parent $ScriptDir

# ============================================================================
# Environment Selection
# ============================================================================
Write-Host "Available Environments:" -ForegroundColor Cyan
Write-Host "   dev     - Development environment"
Write-Host "   prod    - Production environment"
Write-Host ""

$Environment = Read-HostWithDefault -Prompt "Enter environment (dev/prod)" -Default "dev"

if ($Environment -notmatch '^(dev|prod)$') {
    Write-Error "Invalid environment: $Environment"
    Write-Host "   Valid values: dev, prod"
    exit 1
}
Write-Success "Environment: $Environment"

# Set environment-specific variables
switch ($Environment) {
    "dev" {
        $NodeEnv = "development"
        $LogLevel = "debug"
    }
    "prod" {
        $NodeEnv = "production"
        $LogLevel = "warn"
    }
}

# ============================================================================
# Suffix Configuration
# ============================================================================
Write-Header "Infrastructure Configuration"

Write-Host "The suffix was set during infrastructure deployment." -ForegroundColor Cyan
Write-Host "You can find it by running:"
Write-Host "   az group list --query `"[?starts_with(name, 'rg-xshopai-$Environment')].{Name:name, Suffix:tags.suffix}`" -o table" -ForegroundColor Blue
Write-Host ""

$Suffix = Read-Host "Enter the infrastructure suffix"

if ([string]::IsNullOrWhiteSpace($Suffix)) {
    Write-Error "Suffix is required. Please run the infrastructure deployment first."
    exit 1
}

if ($Suffix -notmatch '^[a-z0-9]{3,6}$') {
    Write-Error "Invalid suffix format: $Suffix"
    Write-Host "   Suffix must be 3-6 lowercase alphanumeric characters."
    exit 1
}
Write-Success "Using suffix: $Suffix"

# ============================================================================
# Derive Resource Names from Infrastructure
# ============================================================================
$ResourceGroup = "rg-$ProjectName-$Environment-$Suffix"
$AcrName = "$ProjectName$Environment$Suffix"
$ContainerEnv = "cae-$ProjectName-$Environment-$Suffix"
$CosmosAccount = "cosmos-$ProjectName-$Environment-$Suffix"
$KeyVault = "kv-$ProjectName-$Environment-$Suffix"
$ManagedIdentity = "id-$ProjectName-$Environment-$Suffix"

Write-Info "Derived resource names:"
Write-Host "   Resource Group:      $ResourceGroup"
Write-Host "   Container Registry:  $AcrName"
Write-Host "   Container Env:       $ContainerEnv"
Write-Host "   Cosmos DB Account:   $CosmosAccount"
Write-Host "   Key Vault:           $KeyVault"
Write-Host ""

# ============================================================================
# Verify Infrastructure Exists
# ============================================================================
Write-Header "Verifying Infrastructure"

# Check Resource Group
try {
    az group show --name $ResourceGroup | Out-Null
    Write-Success "Resource Group exists: $ResourceGroup"
} catch {
    Write-Error "Resource group '$ResourceGroup' does not exist."
    Write-Host ""
    Write-Host "Please run the infrastructure deployment first:"
    Write-Host "   cd infrastructure/azure/aca/scripts" -ForegroundColor Blue
    Write-Host "   ./deploy-infra.ps1" -ForegroundColor Blue
    exit 1
}

# Check ACR
try {
    $AcrLoginServer = az acr show --name $AcrName --query loginServer -o tsv
    Write-Success "Container Registry exists: $AcrLoginServer"
} catch {
    Write-Error "Container Registry '$AcrName' does not exist."
    exit 1
}

# Check Container Apps Environment
try {
    az containerapp env show --name $ContainerEnv --resource-group $ResourceGroup | Out-Null
    Write-Success "Container Apps Environment exists: $ContainerEnv"
} catch {
    Write-Error "Container Apps Environment '$ContainerEnv' does not exist."
    exit 1
}

# Check Cosmos DB Account
try {
    az cosmosdb show --name $CosmosAccount --resource-group $ResourceGroup | Out-Null
    Write-Success "Cosmos DB Account exists: $CosmosAccount"
} catch {
    Write-Error "Cosmos DB Account '$CosmosAccount' does not exist."
    exit 1
}

# Get Managed Identity ID
try {
    $IdentityId = az identity show --name $ManagedIdentity --resource-group $ResourceGroup --query id -o tsv
    Write-Success "Managed Identity exists: $ManagedIdentity"
} catch {
    Write-Warning "Managed Identity not found, will deploy without it"
    $IdentityId = $null
}

# ============================================================================
# Database Configuration
# ============================================================================
Write-Header "Database Configuration"

$DbName = "user_service_db"
Write-Info "Database name: $DbName"

# Get Cosmos DB connection details
Write-Info "Retrieving Cosmos DB connection details..."

try {
    $CosmosConnectionString = az cosmosdb keys list `
        --name $CosmosAccount `
        --resource-group $ResourceGroup `
        --type connection-strings `
        --query "connectionStrings[0].connectionString" `
        -o tsv
} catch {
    Write-Warning "Could not retrieve Cosmos DB connection string"
    Write-Info "Checking if local auth is enabled..."
    
    # Try to enable local auth
    Write-Info "Enabling local auth on Cosmos DB..."
    $SubscriptionId = az account show --query id -o tsv
    az resource update `
        --ids "/subscriptions/$SubscriptionId/resourceGroups/$ResourceGroup/providers/Microsoft.DocumentDB/databaseAccounts/$CosmosAccount" `
        --set properties.disableLocalAuth=false `
        --output none 2>$null
    
    # Wait for propagation
    Write-Info "Waiting for settings to propagate (30s)..."
    Start-Sleep -Seconds 30
    
    # Try again
    $CosmosConnectionString = az cosmosdb keys list `
        --name $CosmosAccount `
        --resource-group $ResourceGroup `
        --type connection-strings `
        --query "connectionStrings[0].connectionString" `
        -o tsv
}

if ([string]::IsNullOrWhiteSpace($CosmosConnectionString)) {
    Write-Error "Could not retrieve Cosmos DB connection string after enabling local auth"
    exit 1
}

# Parse connection string and add database name
if ($CosmosConnectionString -match '\?') {
    $DbConnection = $CosmosConnectionString -replace '\?', "/$DbName?"
} else {
    $DbConnection = "$CosmosConnectionString/$DbName"
}

Write-Success "Database connection configured"

# ============================================================================
# Confirmation
# ============================================================================
Write-Header "Deployment Configuration Summary"

Write-Host "Environment:          $Environment" -ForegroundColor Cyan
Write-Host "Suffix:               $Suffix" -ForegroundColor Cyan
Write-Host "Resource Group:       $ResourceGroup" -ForegroundColor Cyan
Write-Host "Container Registry:   $AcrLoginServer" -ForegroundColor Cyan
Write-Host "Container Env:        $ContainerEnv" -ForegroundColor Cyan
Write-Host "Cosmos DB Account:    $CosmosAccount" -ForegroundColor Cyan
Write-Host "Database:             $DbName" -ForegroundColor Cyan
Write-Host ""
Write-Host "Service Configuration:" -ForegroundColor Cyan
Write-Host "   Service Name:      $ServiceName"
Write-Host "   Service Version:   $ServiceVersion"
Write-Host "   App Port:          $AppPort"
Write-Host "   NODE_ENV:          $NodeEnv"
Write-Host "   LOG_LEVEL:         $LogLevel"
Write-Host "   Dapr HTTP Port:    $DaprHttpPort"
Write-Host "   Dapr PubSub Name:  $DaprPubsubName"
Write-Host ""

$Confirm = Read-Host "Do you want to proceed with deployment? (y/N)"
if ($Confirm -notmatch '^[Yy]$') {
    Write-Warning "Deployment cancelled by user"
    exit 0
}

# ============================================================================
# Step 1: Build and Push Container Image
# ============================================================================
Write-Header "Step 1: Building and Pushing Container Image"

# Login to ACR
Write-Info "Logging into ACR..."
az acr login --name $AcrName
Write-Success "Logged into ACR"

# Navigate to service directory
Push-Location $ServiceDir

try {
    # Build Docker image (using production target)
    Write-Info "Building Docker image..."
    docker build --target production -t "${ServiceName}:latest" .
    Write-Success "Docker image built"

    # Tag and push
    $ImageTag = "$AcrLoginServer/${ServiceName}:latest"
    docker tag "${ServiceName}:latest" $ImageTag
    Write-Info "Pushing image to ACR..."
    docker push $ImageTag
    Write-Success "Image pushed: $ImageTag"
} finally {
    Pop-Location
}

# ============================================================================
# Step 2: Deploy Container App
# ============================================================================
Write-Header "Step 2: Deploying Container App"

# Get ACR credentials
$AcrPassword = az acr credential show --name $AcrName --query "passwords[0].value" -o tsv

# Check if container app exists
$AppExists = $false
try {
    az containerapp show --name $ServiceName --resource-group $ResourceGroup | Out-Null
    $AppExists = $true
} catch {
    $AppExists = $false
}

if ($AppExists) {
    Write-Info "Container app '$ServiceName' exists, updating..."
    az containerapp update `
        --name $ServiceName `
        --resource-group $ResourceGroup `
        --image $ImageTag `
        --set-env-vars `
            "NODE_ENV=$NodeEnv" `
            "NAME=$ServiceName" `
            "VERSION=$ServiceVersion" `
            "PORT=$AppPort" `
            "DATABASE_URL=$DbConnection" `
            "DAPR_HTTP_PORT=$DaprHttpPort" `
            "DAPR_PUBSUB_NAME=$DaprPubsubName" `
            "LOG_LEVEL=$LogLevel" `
        --output none
    Write-Success "Container app updated"
} else {
    Write-Info "Creating container app '$ServiceName'..."
    
    $CreateArgs = @(
        "--name", $ServiceName,
        "--resource-group", $ResourceGroup,
        "--environment", $ContainerEnv,
        "--image", $ImageTag,
        "--registry-server", $AcrLoginServer,
        "--registry-username", $AcrName,
        "--registry-password", $AcrPassword,
        "--target-port", $AppPort,
        "--ingress", "external",
        "--min-replicas", "1",
        "--max-replicas", "5",
        "--cpu", "0.5",
        "--memory", "1.0Gi",
        "--enable-dapr",
        "--dapr-app-id", $ServiceName,
        "--dapr-app-port", $AppPort,
        "--env-vars",
            "NODE_ENV=$NodeEnv",
            "NAME=$ServiceName",
            "VERSION=$ServiceVersion",
            "PORT=$AppPort",
            "DATABASE_URL=$DbConnection",
            "DAPR_HTTP_PORT=$DaprHttpPort",
            "DAPR_PUBSUB_NAME=$DaprPubsubName",
            "LOG_LEVEL=$LogLevel",
        "--output", "none"
    )
    
    if ($IdentityId) {
        $CreateArgs += @("--user-assigned", $IdentityId)
    }
    
    az containerapp create @CreateArgs
    Write-Success "Container app created"
}

# ============================================================================
# Step 3: Verify Deployment
# ============================================================================
Write-Header "Step 3: Verifying Deployment"

$AppUrl = az containerapp show `
    --name $ServiceName `
    --resource-group $ResourceGroup `
    --query properties.configuration.ingress.fqdn `
    -o tsv

Write-Success "Deployment completed!"
Write-Host ""
Write-Info "Application URL: https://$AppUrl"
Write-Info "Health Check:    https://$AppUrl/health/ready"
Write-Host ""

# Test health endpoint
Write-Info "Waiting for app to start (30s)..."
Start-Sleep -Seconds 30

Write-Info "Testing health endpoint..."
try {
    $Response = Invoke-WebRequest -Uri "https://$AppUrl/health/ready" -UseBasicParsing -TimeoutSec 30
    if ($Response.StatusCode -eq 200) {
        Write-Success "Health check passed! (HTTP $($Response.StatusCode))"
    } else {
        Write-Warning "Health check returned HTTP $($Response.StatusCode). The app may still be starting."
    }
} catch {
    Write-Warning "Health check failed. The app may still be starting."
}

# ============================================================================
# Summary
# ============================================================================
Write-Header "Deployment Summary"

Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "   ✅ $ServiceName DEPLOYED SUCCESSFULLY" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Application:" -ForegroundColor Cyan
Write-Host "   URL:              https://$AppUrl"
Write-Host "   Health:           https://$AppUrl/health/ready"
Write-Host ""
Write-Host "Infrastructure:" -ForegroundColor Cyan
Write-Host "   Resource Group:   $ResourceGroup"
Write-Host "   Environment:      $ContainerEnv"
Write-Host "   Registry:         $AcrLoginServer"
Write-Host ""
Write-Host "Database:" -ForegroundColor Cyan
Write-Host "   Account:          $CosmosAccount"
Write-Host "   Database:         $DbName"
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Cyan
Write-Host "   View logs:        az containerapp logs show --name $ServiceName --resource-group $ResourceGroup --follow" -ForegroundColor Blue
Write-Host "   View Dapr logs:   az containerapp logs show --name $ServiceName --resource-group $ResourceGroup --container daprd --follow" -ForegroundColor Blue
Write-Host "   Delete app:       az containerapp delete --name $ServiceName --resource-group $ResourceGroup --yes" -ForegroundColor Blue
Write-Host ""
