// User Service Infrastructure
@description('Location for all resources')
param location string = resourceGroup().location

@description('Environment name (dev, staging, prod)')
param environment string = 'dev'

@description('Cosmos DB account name')
param cosmosDbAccountName string = 'cosmos-xshopai'

@description('App Service Plan SKU')
param appServicePlanSku string = 'B1'

@description('Node.js version')
param nodeVersion string = '24-lts'

// Variables
var appServicePlanName = 'asp-user'
var appServiceName = 'user'
var databaseName = 'userdb'
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
      alwaysOn: appServicePlanSku != 'B1'
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

// Enable Dapr on App Service
resource daprExtension 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: appService
  name: 'web'
  properties: {
    daprConfig: {
      enabled: true
      appId: 'user-service'
      appPort: 1002
      httpReadBufferSize: 4
      httpMaxRequestSize: 10
      logLevel: environment == 'prod' ? 'info' : 'debug'
      enableApiLogging: true
    }
  }
}

// Outputs
output appServiceName string = appService.name
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output cosmosDbAccountName string = cosmosDbAccount.name
output cosmosDbConnectionString string = cosmosDbAccount.listConnectionStrings().connectionStrings[0].connectionString
