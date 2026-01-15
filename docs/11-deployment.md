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

## Cloud Platform Deployment

### AWS EC2

1. **Launch EC2 Instance**
   ```bash
   # Choose Ubuntu 22.04 LTS
   # t3.medium or larger recommended
   ```

2. **Install Dependencies**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Docker
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER

   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **Deploy Application**
   ```bash
   # Clone repository
   git clone <your-repo> /opt/bunkit
   cd /opt/bunkit

   # Set environment variables
   cp .env.example .env
   nano .env  # Edit with production values

   # Start services
   docker-compose up -d
   ```

4. **Configure Security Group**
   - Allow HTTP (80)
   - Allow HTTPS (443)
   - Allow SSH (22) from your IP only

### Google Cloud Run

1. **Build and Push Image**
   ```bash
   # Enable Container Registry
   gcloud services enable containerregistry.googleapis.com

   # Build and push
   gcloud builds submit --tag gcr.io/PROJECT_ID/bunkit-backend apps/backend

   # Or use Docker
   docker build -t gcr.io/PROJECT_ID/bunkit-backend -f apps/backend/Dockerfile .
   docker push gcr.io/PROJECT_ID/bunkit-backend
   ```

2. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy bunkit-backend \
     --image gcr.io/PROJECT_ID/bunkit-backend \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars "NODE_ENV=production,DATABASE_URL=..." \
     --set-secrets "JWT_SECRET=jwt-secret:latest"
   ```

3. **Set Up Cloud SQL**
   ```bash
   # Create PostgreSQL instance
   gcloud sql instances create bunkit-db \
     --database-version=POSTGRES_14 \
     --tier=db-f1-micro \
     --region=us-central1

   # Create database
   gcloud sql databases create bunkit --instance=bunkit-db

   # Connect Cloud Run to Cloud SQL
   gcloud run services update bunkit-backend \
     --add-cloudsql-instances PROJECT_ID:us-central1:bunkit-db
   ```

### Digital Ocean

1. **Create Droplet**
   - Ubuntu 22.04
   - 2GB RAM minimum
   - Enable monitoring

2. **Set Up Domain**
   - Point A records to droplet IP
   - `yourdomain.com` → Droplet IP
   - `api.yourdomain.com` → Droplet IP

3. **Install and Deploy**
   ```bash
   # SSH into droplet
   ssh root@your-droplet-ip

   # Install Docker
   curl -fsSL https://get.docker.com | sh

   # Clone and deploy
   git clone <your-repo> /opt/bunkit
   cd /opt/bunkit
   cp .env.example .env
   nano .env
   docker-compose up -d
   ```

4. **Set Up SSL with Let's Encrypt**
   ```bash
   # Install certbot
   sudo apt install certbot python3-certbot-nginx

   # Get certificates
   sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

   # Auto-renewal is configured automatically
   ```

### Railway

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Initialize Project**
   ```bash
   railway init
   railway link
   ```

3. **Add PostgreSQL**
   ```bash
   railway add postgresql
   ```

4. **Set Environment Variables**
   ```bash
   railway variables set NODE_ENV=production
   railway variables set JWT_SECRET=<your-secret>
   railway variables set CORS_ORIGIN=https://your-domain.com
   ```

5. **Deploy**
   ```bash
   railway up
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

## Database Management

### Backup

```bash
# Backup database
docker-compose exec postgres pg_dump -U bunkit bunkit > backup-$(date +%Y%m%d).sql

# Restore database
docker-compose exec -T postgres psql -U bunkit bunkit < backup-20250115.sql

# Automated daily backups
cat > /etc/cron.daily/backup-bunkit << 'EOF'
#!/bin/bash
cd /opt/bunkit
docker-compose exec -T postgres pg_dump -U bunkit bunkit | gzip > /backups/bunkit-$(date +%Y%m%d).sql.gz
# Keep only last 30 days
find /backups -name "bunkit-*.sql.gz" -mtime +30 -delete
EOF

chmod +x /etc/cron.daily/backup-bunkit
```

### Migrations

```bash
# Run migrations in production
docker-compose exec backend bun run db:migrate

# Or manually
docker-compose exec postgres psql -U bunkit bunkit < migration.sql
```

## Monitoring & Logging

### Health Checks

```bash
# Check backend health
curl https://api.example.com/api/health

# Check frontend
curl https://example.com

# Monitor in docker-compose
docker-compose ps
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend

# Follow with timestamps
docker-compose logs -f -t backend
```

### Log Aggregation

#### With Loki (Grafana)

```yaml
# docker-compose.yml
services:
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:latest
    volumes:
      - /var/log:/var/log
      - ./promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
```

## SSL/TLS Certificates

### Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run

# Certificate location
/etc/letsencrypt/live/yourdomain.com/fullchain.pem
/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### Manual Certificate

```bash
# Generate self-signed (development only!)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout key.pem -out cert.pem

# Use in nginx
ssl_certificate /path/to/cert.pem;
ssl_certificate_key /path/to/key.pem;
```

## Performance Optimization

### Database Connection Pooling

```typescript
// Use PgBouncer or connection pooling
const db = drizzle(postgres(process.env.DATABASE_URL!, {
  max: 20,        // Maximum connections
  idle_timeout: 30,
  connect_timeout: 10
}))
```

### Redis Caching

```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
```

### CDN for Static Assets

```nginx
# Nginx cache static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## Security Checklist

- [ ] Use strong JWT secrets (64+ characters)
- [ ] Enable HTTPS/TLS everywhere
- [ ] Set specific CORS origins (no wildcards in production)
- [ ] Use environment variables for secrets
- [ ] Enable database SSL connections
- [ ] Set up firewall rules
- [ ] Keep dependencies updated
- [ ] Enable rate limiting
- [ ] Set up monitoring and alerts
- [ ] Regular database backups
- [ ] Use secrets management (AWS Secrets Manager, Vault)
- [ ] Enable DDoS protection
- [ ] Set security headers (CSP, HSTS, X-Frame-Options)

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs backend

# Check environment variables
docker-compose exec backend env

# Inspect container
docker inspect bunkit_backend_1
```

### Database Connection Issues

```bash
# Test database connection
docker-compose exec postgres psql -U bunkit -d bunkit -c "SELECT 1"

# Check network
docker network ls
docker network inspect bunkit_default
```

### High Memory Usage

```bash
# Check resource usage
docker stats

# Limit container resources
# docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

## Next Steps

- Set up [Monitoring](https://grafana.com/)
- Configure [CI/CD pipeline](.github/workflows)
- Review [Security Best Practices](./09-authentication.md)
- Set up [Database Backups](#database-management)
