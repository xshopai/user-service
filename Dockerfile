# =============================================================================
# Multi-stage Dockerfile for Node.js User Service
# =============================================================================

# -----------------------------------------------------------------------------
# Base stage - Common setup for all stages
# -----------------------------------------------------------------------------
FROM node:24-alpine AS base
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S userservice -u 1001 -G nodejs

# -----------------------------------------------------------------------------
# Dependencies stage - Install all dependencies
# -----------------------------------------------------------------------------
FROM base AS dependencies
COPY package*.json ./
RUN npm ci --include=dev && npm cache clean --force

# -----------------------------------------------------------------------------
# Development stage - For local development with hot reload
# -----------------------------------------------------------------------------
FROM dependencies AS development

# Copy application code
# Note: In development, mount code as volume: docker run -v ./:/app
COPY --chown=userservice:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown -R userservice:nodejs logs

# Switch to non-root user
USER userservice

# Expose port
EXPOSE 8002

# Health check (using Node.js to avoid curl dependency)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8002/health/live', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Use dumb-init and start development server
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "dev"]

# -----------------------------------------------------------------------------
# Build stage - Build the application
# -----------------------------------------------------------------------------
FROM dependencies AS build

# Copy source code
COPY . .

# Remove development dependencies
RUN npm ci --omit=dev && npm cache clean --force

# -----------------------------------------------------------------------------
# Production stage - Optimized for production deployment
# -----------------------------------------------------------------------------
FROM base AS production

# Copy only production dependencies
COPY --from=build --chown=userservice:nodejs /app/node_modules ./node_modules

# Copy application code (unnecessary files excluded via .dockerignore)
COPY --chown=userservice:nodejs . .

# Create logs directory
RUN mkdir -p logs && chown -R userservice:nodejs logs

# Switch to non-root user
USER userservice

# Expose port
EXPOSE 8002

# Health check (using Node.js to avoid curl dependency)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8002/health/ready', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
# In production (Azure Container Apps), Dapr is provided as a sidecar
# So we run the app directly instead of through Dapr CLI
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]

# Labels for better image management and security scanning
LABEL maintainer="xshopai Team"
LABEL service="user-service"
LABEL version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/xshopai/user-service"
LABEL org.opencontainers.image.description="User Service for xshopai platform"
LABEL org.opencontainers.image.vendor="xshopai"
