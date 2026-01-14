FROM oven/bun:1.3.5-alpine AS base

# Install dependencies stage
FROM base AS deps
WORKDIR /app

# Copy workspace files (monorepo requires all package.json files)
COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/server/package.json ./packages/server/
COPY packages/result/package.json ./packages/result/

# Install ALL dependencies (including devDependencies needed for migrations)
# Note: drizzle-kit is required for migrations (in devDependencies)
RUN bun install --frozen-lockfile

# Build stage (if needed for packages)
FROM base AS builder
WORKDIR /app

# Copy workspace files
COPY package.json bun.lock tsconfig.json ./
COPY apps/backend ./apps/backend
COPY packages ./packages

# Copy dependencies (both root and workspace node_modules for symlinks)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules

# Production stage
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Copy necessary files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps/backend ./apps/backend
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules
# Copy workspace node_modules to preserve drizzle-kit symlinks
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy entrypoint script
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 bunkit && \
    chown -R bunkit:nodejs /app

USER bunkit

WORKDIR /app/apps/backend

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun run -e 'fetch("http://localhost:3001/api/health").then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))'

ENTRYPOINT ["docker-entrypoint.sh"]
