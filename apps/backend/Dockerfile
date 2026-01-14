# ============================================================================
# Base Stage - Shared base image for all stages
# ============================================================================
FROM oven/bun:1.3.5-alpine AS base


# ============================================================================
# Dependencies Stage - Install all dependencies including devDependencies
# ============================================================================
FROM base AS deps
WORKDIR /app

# Copy all package.json files from monorepo
# (Required for Bun workspace lockfile validation)
COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/server/package.json ./packages/server/
COPY packages/result/package.json ./packages/result/

# Install all dependencies (including devDependencies)
# - drizzle-kit needed for database migrations
# - Other devDependencies may be needed for build steps
RUN bun install --frozen-lockfile


# ============================================================================
# Builder Stage - Prepare application for production
# ============================================================================
FROM base AS builder
WORKDIR /app

# Copy source code
COPY package.json bun.lock tsconfig.json ./
COPY apps/backend ./apps/backend
COPY packages ./packages

# Copy installed dependencies from deps stage
# Bun workspaces use symlinks in each workspace's node_modules that point to
# the actual packages in node_modules/.bun/, so we must copy both:
# 1. Root node_modules (contains the actual packages in .bun/)
# 2. Workspace node_modules (contains symlinks to root)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=deps /app/packages/ ./packages/


# ============================================================================
# Production Stage - Final optimized image
# ============================================================================
FROM base AS runner
WORKDIR /app

# Production environment variables
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Copy application code and dependencies from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps/backend ./apps/backend
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy and setup entrypoint script
# (Handles database connection waiting and automatic migrations)
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Security: Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 bunkit && \
    chown -R bunkit:nodejs /app

USER bunkit

# Set working directory to backend app
WORKDIR /app/apps/backend

# Expose backend API port
EXPOSE 3001

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e 'fetch("http://localhost:3001/api/health").then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))'

# Start application via entrypoint script
ENTRYPOINT ["docker-entrypoint.sh"]
