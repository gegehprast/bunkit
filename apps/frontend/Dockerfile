FROM oven/bun:1.3.5-alpine AS base

# Install dependencies stage
FROM base AS deps
WORKDIR /app

# Copy workspace files
COPY package.json bun.lock ./
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies
RUN bun install --frozen-lockfile

# Build stage
FROM base AS builder
WORKDIR /app

# Copy workspace configuration
COPY package.json bun.lock tsconfig.json ./
COPY apps/frontend ./apps/frontend

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules

# Build the frontend
WORKDIR /app/apps/frontend
RUN bun run build

# Production stage with nginx
FROM nginx:alpine AS runner

# Copy built assets
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
