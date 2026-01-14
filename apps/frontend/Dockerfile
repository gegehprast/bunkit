# ============================================================================
# Base Stage - Shared base image for all stages
# ============================================================================
FROM oven/bun:1.3.5-alpine AS base


# ============================================================================
# Dependencies Stage - Install all dependencies for building
# ============================================================================
FROM base AS deps
WORKDIR /app

# Copy all package.json files from monorepo
# (Required for Bun workspace lockfile validation)
COPY package.json bun.lock ./
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/
COPY packages/server/package.json ./packages/server/
COPY packages/result/package.json ./packages/result/

# Install all dependencies
# Frontend needs all deps for build process (vite, react, etc.)
RUN bun install --frozen-lockfile


# ============================================================================
# Builder Stage - Build the frontend application
# ============================================================================
FROM base AS builder
WORKDIR /app

# Copy source code
COPY package.json bun.lock tsconfig.json ./
COPY apps/frontend ./apps/frontend

# Copy installed dependencies from deps stage
# Bun workspaces use symlinks in each workspace's node_modules that point to
# the actual packages in node_modules/.bun/, so we must copy both:
# 1. Root node_modules (contains the actual packages in .bun/)
# 2. Workspace node_modules (contains symlinks to root)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules

# Build the frontend application
WORKDIR /app/apps/frontend
RUN bun run build


# ============================================================================
# Production Stage - Serve with nginx
# ============================================================================
FROM nginx:alpine AS runner

# Copy built static assets
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

# Copy nginx configuration for SPA routing
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Health check endpoint (use 127.0.0.1 to force IPv4)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

# Expose HTTP port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
