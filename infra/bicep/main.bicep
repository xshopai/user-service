// User Service Infrastructure
@description('Location for all resources')
param location string = resourceGroup().location

@description('Environment name (dev, staging, prod)')
param environment string = 'dev'

@description('Cosmos DB account name')
param cosmosDbAccountName string = 'cosmos-xshopai'

@description('App Service Plan SKU')
@allowed([
  'F1'   // Free tier
  'D1'   // Shared tier
  'B1'   // Basic tier
  'B2'
  'B3'
  'S1'   // Standard tier
  'S2'
  'S3'
  'P1v2' // Premium v2
  'P2v2'
  'P3v2'
  'P1v3' // Premium v3
  'P2v3'
  'P3v3'
  'I1v2' // Isolated v2
  'I2v2'
  'I3v2'
  'I1mv2' // Isolated Memory optimized v2
  'I2mv2'
  'I3mv2'
])
param appServicePlanSku string = 'F1'

@description('Node.js version')
param nodeVersion string = '24-lts'

// Variables
var appServicePlanName = environment == 'prod' ? 'asp-user-prod' : 'asp-user'
var appServiceName = environment == 'prod' ? 'user-prod' : 'user'
var databaseName = environment == 'prod' ? 'userdb-prod' : 'userdb'
var collectionName = 'users'

// Cosmos DB Account (MongoDB API)
resource cosmosDbAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: cosmosDbAccountName
  location: location
  kind: 'MongoDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      {
        name: 'EnableMongo'
      }
    ]
    enableFreeTier: environment == 'dev' ? true : false
    enableAutomaticFailover: false
    enableMultipleWriteLocations: false
  }
}

// MongoDB Database
resource mongoDatabase 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2024-05-15' = {
  parent: cosmosDbAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
    options: {
      throughput: environment == 'dev' ? 400 : 1000
    }
  }
}

// MongoDB Collection
resource mongoCollection 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases/collections@2024-05-15' = {
  parent: mongoDatabase
  name: collectionName
  properties: {
    resource: {
      id: collectionName
      shardKey: {
        _id: 'Hash'
      }
      indexes: [
        {
          key: {
            keys: ['_id']
          }
        }
        {
          key: {
            keys: ['email']
          }
          options: {
            unique: true
          }
        }
      ]
    }
  }
}

// App Service Plan
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  sku: {
    name: appServicePlanSku
  }
  properties: {
    reserved: true
  }
}

// App Service
resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: appServiceName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'NODE|${nodeVersion}'
      alwaysOn: appServicePlanSku != 'F1' && appServicePlanSku != 'D1' // AlwaysOn not available on Free/Shared
      healthCheckPath: '/readiness'
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      appSettings: [
        {
          name: 'NODE_ENV'
          value: environment == 'prod' ? 'production' : 'development'
        }
        {
          name: 'PORT'
          value: '1002'
        }
        {
          name: 'NAME'
          value: 'user-service'
        }
        {
          name: 'VERSION'
          value: '1.0.0'
        }
        {
          name: 'LOG_LEVEL'
          value: environment == 'prod' ? 'info' : 'debug'
        }
        {
          name: 'LOG_FORMAT'
          value: 'json'
        }
        {
          name: 'LOG_TO_CONSOLE'
          value: 'true'
        }
        {
          name: 'LOG_TO_FILE'
          value: 'false'
        }
        {
          name: 'MONGODB_URI'
          value: 'mongodb://${cosmosDbAccount.name}:${cosmosDbAccount.listConnectionStrings().connectionStrings[0].connectionString}@${cosmosDbAccount.name}.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@${cosmosDbAccount.name}@'
        }
        {
          name: 'DAPR_HOST'
          value: 'localhost'
        }
        {
          name: 'DAPR_HTTP_PORT'
          value: '3500'
        }
        {
          name: 'DAPR_GRPC_PORT'
          value: '50001'
        }
        {
          name: 'DAPR_APP_ID'
          value: 'user-service'
        }
        {
          name: 'JWT_ALGORITHM'
          value: 'HS256'
        }
        {
          name: 'JWT_EXPIRATION'
          value: '3600'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~24'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
      ]
    }
    httpsOnly: true
  }
}

// Outputs
output appServiceName string = appService.name
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output cosmosDbAccountName string = cosmosDbAccount.name
output cosmosDbEndpoint string = cosmosDbAccount.properties.documentEndpoint
