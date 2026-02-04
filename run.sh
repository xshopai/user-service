#!/bin/bash

# User Service - Run with Dapr

echo "Starting User Service with Dapr..."
echo "Service will be available at: http://localhost:8002"
echo "Dapr HTTP endpoint: http://localhost:3502"
echo "Dapr gRPC endpoint: localhost:50002"
echo ""

dapr run \
  --app-id user-service \
  --app-port 8002 \
  --dapr-http-port 3502 \
  --dapr-grpc-port 50002 \
  --log-level info \
  --config ./.dapr/config.yaml \
  --resources-path ./.dapr/components \
  -- node src/server.js

