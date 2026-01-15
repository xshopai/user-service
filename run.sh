#!/usr/bin/env bash
# Run User Service with Dapr sidecar
# Usage: ./run.sh

echo -e "\033[0;32mStarting User Service with Dapr...\033[0m"
echo -e "\033[0;36mService will be available at: http://localhost:8002\033[0m"
echo -e "\033[0;36mDapr HTTP endpoint: http://localhost:3502\033[0m"
echo -e "\033[0;36mDapr gRPC endpoint: localhost:50002\033[0m"
echo ""

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

dapr run \
  --app-id user-service \
  --app-port 8002 \
  --dapr-http-port 3502 \
  --dapr-grpc-port 50002 \
  --resources-path "$SCRIPT_DIR/.dapr/components" \
  --config "$SCRIPT_DIR/.dapr/config.yaml" \
  --log-level warn \
  -- nodemon src/server.js
