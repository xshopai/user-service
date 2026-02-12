#!/bin/bash

# User Service - Run with Dapr Pub/Sub

echo "Starting User Service (Dapr Pub/Sub)..."
echo "Service will be available at: http://localhost:8002"
echo "Dapr HTTP endpoint: http://localhost:3502"
echo "Dapr gRPC endpoint: localhost:50002"
echo ""

# Kill any processes using required ports (prevents "address already in use" errors)
for PORT in 8002 3502 50002; do
    for pid in $(netstat -ano 2>/dev/null | grep ":$PORT" | grep LISTENING | awk '{print $5}' | sort -u); do
        echo "Killing process $pid on port $PORT..."
        taskkill //F //PID $pid 2>/dev/null
    done
done

dapr run \
  --app-id user-service \
  --app-port 8002 \
  --dapr-http-port 3502 \
  --dapr-grpc-port 50002 \
  --log-level info \
  --config ./.dapr/config.yaml \
  --resources-path ./.dapr/components \
  -- node src/server.js

