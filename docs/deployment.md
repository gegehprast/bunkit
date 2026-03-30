# Deployment Guide

Complete guide for deploying BunKit to production environments using Docker, Docker Compose, and various cloud platforms.

## Docker Deployment

### Dockerfile
Both the backend and frontend have their own Dockerfiles located in `apps/backend/Dockerfile` and `apps/frontend/Dockerfile` respectively.

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
A `docker-compose.yml` file located at the root of the project orchestrates the backend, frontend, and database services.

### Environment Variables

Create `.env` at the root directory for docker-compose:

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

Refer to the `.env.compose.example` for up to date variables.

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

## Environment Variables for Production

### Backend (.env)

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

### Frontend (.env)

```bash
VITE_API_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com
```
