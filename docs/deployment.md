# Deployment Guide

Complete guide for deploying BunKit to production environments using Docker, Docker Compose, and various cloud platforms.

## Docker Deployment

### Backend Dockerfile

The backend includes a production-ready Dockerfile:

```dockerfile
# apps/backend/Dockerfile
FROM oven/bun:1.3 as base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
COPY packages/server/package.json ./packages/server/
COPY packages/result/package.json ./packages/result/
RUN bun install --frozen-lockfile --production

# Copy application code
COPY apps/backend ./apps/backend
COPY packages ./packages

# Run migrations on startup
WORKDIR /app/apps/backend
COPY apps/backend/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "run", "src/main.ts"]
```

### Frontend Dockerfile

```dockerfile
# apps/frontend/Dockerfile
FROM oven/bun:1.3 as builder
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy and build
COPY apps/frontend ./apps/frontend
WORKDIR /app/apps/frontend
RUN bun run build

# Production image
FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Build Images

```bash
# Build backend
docker build -t bunkit-backend:latest -f apps/backend/Dockerfile .

# Build frontend
docker build -t bunkit-frontend:latest -f apps/frontend/Dockerfile .

# Push to registry (optional)
docker tag bunkit-backend:latest your-registry/bunkit-backend:latest
docker push your-registry/bunkit-backend:latest
```

## Docker Compose

### Production docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: bunkit
      POSTGRES_USER: bunkit
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bunkit"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped
    networks:
      - bunkit

  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://bunkit:${POSTGRES_PASSWORD}@postgres:5432/bunkit
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      CORS_ORIGIN: https://yourdomain.com
      PORT: 3001
      HOST: 0.0.0.0
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
    networks:
      - bunkit

  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
    environment:
      VITE_API_URL: https://api.yourdomain.com
      VITE_WS_URL: wss://api.yourdomain.com
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - bunkit

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - backend
      - frontend
    restart: unless-stopped
    networks:
      - bunkit

volumes:
  postgres_data:

networks:
  bunkit:
    driver: bridge
```

### Environment Variables

Create `.env` for docker-compose:

```bash
# Database
POSTGRES_PASSWORD=<secure-password>

# JWT Secrets
JWT_SECRET=<generate-with-crypto.randomBytes(32).toString('hex')>
JWT_REFRESH_SECRET=<generate-with-crypto.randomBytes(32).toString('hex')>

# Optional
POSTGRES_USER=bunkit
POSTGRES_DB=bunkit
```

### Start Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Stop services
docker-compose down

# Stop and remove volumes (DESTRUCTIVE!)
docker-compose down -v
```

## Nginx Reverse Proxy

### nginx.conf

```nginx
upstream backend {
    server backend:3001;
}

upstream frontend {
    server frontend:80;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name yourdomain.com api.yourdomain.com;
    return 301 https://$host$request_uri;
}

# Frontend
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Backend API
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # API endpoints
    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket upgrade
    location /ws/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Health check
    location /api/health {
        proxy_pass http://backend;
        access_log off;
    }
}
```

## Environment Variables for Production

### Backend (.env.production)

```bash
# Application
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database (use connection pooling in production)
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# JWT (MUST be different from development!)
JWT_SECRET=<64-char-hex-string>
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=<64-char-hex-string>
JWT_REFRESH_EXPIRES_IN=30d

# CORS (specific domains only!)
CORS_ORIGIN=https://app.example.com,https://www.example.com

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Security
BCRYPT_ROUNDS=12

# Optional: External services
SENTRY_DSN=<your-sentry-dsn>
REDIS_URL=redis://localhost:6379
```

### Frontend (.env.production)

```bash
VITE_API_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com
```
