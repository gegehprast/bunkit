# Deploying BunKit to Dokploy

This guide explains how to deploy your BunKit application to [Dokploy](https://dokploy.com/), a self-hosted PaaS platform.

## Prerequisites

- Dokploy instance running and accessible
- GitHub/GitLab repository connected to Dokploy

## Deployment Approaches

You have **two options** for deploying to Dokploy:

### Option 1: Separate Services (Recommended)
- Use Dokploy's managed PostgreSQL database
- Deploy backend and frontend as separate applications
- **Pros**: Better resource management, easier scaling, automatic backups
- **Cons**: Requires more configuration steps

### Option 2: Docker Compose Stack
- Deploy the entire `docker-compose.yml` as a single stack
- PostgreSQL runs as a container alongside your apps
- **Pros**: Simpler setup, everything in one place
- **Cons**: Less flexible, harder to scale database separately

**This guide covers Option 1 (Recommended).** For Option 2, see [Docker Compose Deployment](#option-2-docker-compose-deployment) at the end.

---

## Option 1: Separate Services Deployment

## Deployment Architecture

```
┌─────────────────────────────────────────────┐
│           Dokploy Instance                  │
│                                             │
│  ┌──────────────┐      ┌──────────────┐   │
│  │   Frontend   │      │   Backend    │   │
│  │  (Nginx:80)  │─────▶│  (Bun:3001)  │   │
│  └──────────────┘      └───────┬──────┘   │
│                                 │          │
│                        ┌────────▼──────┐   │
│                        │  PostgreSQL   │   │
│                        │    :5432      │   │
│                        └───────────────┘   │
└─────────────────────────────────────────────┘
```

## Step 1: Test Locally (Optional)

Before deploying to Dokploy, test the Docker setup locally using docker-compose:

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your local settings
nano .env

# Build and start all services
docker-compose up --build

# Test:
# - Backend: http://localhost:3001/api/health
# - Frontend: http://localhost:3000
```

This helps catch any Docker configuration issues before deployment.

## Step 2: Prepare Your Repository

1. **Commit all Docker files** (already created):
   - `apps/backend/Dockerfile`
   - `apps/backend/.dockerignore`
   - `apps/frontend/Dockerfile`
   - `apps/frontend/.dockerignore`
   - `apps/frontend/nginx.conf`
   - `docker-compose.yml` (for local testing)

2. **Push to your Git repository**:
   ```bash
   git add .
   git commit -m "Add Docker configuration for Dokploy deployment"
   git push origin main
   ```

## Step 3: Create PostgreSQL Database in Dokploy

1. Go to your Dokploy dashboard
2. Navigate to **Databases** → **Create Database**
3. Choose **PostgreSQL**
4. Configure:
   - **Name**: `bunkit-db`
   - **Database Name**: `bunkit`
   - **Username**: `bunkit`
   - **Password**: Generate a strong password
   - **Version**: `16` (or latest)
5. Click **Create**
6. Note the connection details (you'll need the internal URL)

## Step 4: Deploy Backend

### Create Backend Application

1. In Dokploy, go to **Applications** → **Create Application**
2. Configure:
   - **Name**: `bunkit-backend`
   - **Repository**: Connect your Git repository
   - **Branch**: `main` (or your default branch)
   - **Build Type**: `Dockerfile`
   - **Dockerfile Path**: `apps/backend/Dockerfile`
   - **Context Path**: `.` (root of monorepo)

### Configure Backend Environment Variables

Add the following environment variables in Dokploy:

```bash
# Application
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Database (use internal Dokploy URL)
DATABASE_URL=postgresql://bunkit:YOUR_PASSWORD@bunkit-db:5432/bunkit

# JWT Secrets (generate strong secrets!)
JWT_SECRET=<generate-32-char-secret>
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=<generate-32-char-secret>
JWT_REFRESH_EXPIRES_IN=30d

# CORS (add your frontend domain)
CORS_ORIGIN=https://your-frontend-domain.com

# Logging
LOG_LEVEL=info
```

**Generate secure secrets**:
```bash
# On your local machine
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For JWT_REFRESH_SECRET
```

### Configure Backend Port & Health Check

- **Port**: `3001`
- **Health Check Path**: `/api/health`
- **Health Check Interval**: `30s`

### Deploy Backend

1. Click **Deploy**
2. Monitor the build logs
3. The backend will automatically:
   - Wait for database to be ready
   - Run migrations on startup
   - Start the application
4. Once deployed, note the internal URL (e.g., `http://bunkit-backend:3001`)

> 💡 **Migrations run automatically** on container startup. Check the logs to verify migration success. If migrations fail, the container won't start.

## Step 5: Deploy Frontend

### Create Frontend Application

1. In Dokploy, go to **Applications** → **Create Application**
2. Configure:
   - **Name**: `bunkit-frontend`
   - **Repository**: Same Git repository
   - **Branch**: `main`
   - **Build Type**: `Dockerfile`
   - **Dockerfile Path**: `apps/frontend/Dockerfile`
   - **Context Path**: `.` (root of monorepo)

### Configure Frontend Build Args (Optional)

If you need to inject backend URL at build time, add build args:

```bash
VITE_API_URL=https://api.yourdomain.com
```

And update your frontend code to use it:
```typescript
// apps/frontend/src/lib/api-client.ts
const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001"
```

### Configure Frontend Port

- **Port**: `80`
- **Health Check Path**: `/health`

### Deploy Frontend

1. Click **Deploy**
2. Monitor the build logs
3. Frontend will be accessible once deployment completes

## Step 6: Configure Domains

### Backend Domain

1. Go to backend application settings
2. Add custom domain (e.g., `api.yourdomain.com`)
3. Enable SSL/TLS (Dokploy handles Let's Encrypt automatically)
4. Update CORS_ORIGIN in backend env vars to include frontend domain

### Frontend Domain

1. Go to frontend application settings
2. Add custom domain (e.g., `app.yourdomain.com` or `yourdomain.com`)
3. Enable SSL/TLS

### Update DNS Records

Point your domains to your Dokploy instance IP:

```
A     api.yourdomain.com    →  YOUR_DOKPLOY_IP
A     app.yourdomain.com    →  YOUR_DOKPLOY_IP
```

## Step 7: Update Frontend to Use Production API

Update your frontend API client to use the production backend URL:

```typescript
// apps/frontend/src/lib/api-client.ts
const baseUrl = import.meta.env.VITE_API_URL || "https://api.yourdomain.com"
```

Commit and push:
```bash
git add apps/frontend/src/lib/api-client.ts
git commit -m "Update API URL for production"
git push origin main
```

Redeploy frontend in Dokploy.

## Step 8: Verify Deployment

1. **Check Backend Health**:
   ```bash
   curl https://api.yourdomain.com/api/health
   # Should return: {"status":"ok","timestamp":"..."}
   ```

2. **Check Frontend**:
   ```bash
   curl https://app.yourdomain.com/health
   # Should return: healthy
   ```

3. **Check API Documentation**:
   Visit: `https://api.yourdomain.com/docs`

4. **Test Full Flow**:
   - Visit your frontend URL
   - Register a new user
   - Login
   - Test features (todos, chat, etc.)

## Monitoring & Logs

### View Logs in Dokploy

1. Go to your application
2. Click **Logs** tab
3. View real-time logs

### Monitor Resource Usage

1. Navigate to **Monitoring** in Dokploy
2. Check CPU, Memory, and Network usage
3. Scale resources if needed

## Troubleshooting

### Backend Won't Start

**Check logs for:**
- Database connection errors
- Missing environment variables
- Migration issues

**Solutions:**
```bash
# Access backend terminal
cd apps/backend

# Check database connection
bun run -e 'console.log(process.env.DATABASE_URL)'

# Run migrations manually
bun run db:migrate

# Check config
bun run typecheck
```

### Frontend Can't Connect to Backend

**Check:**
1. CORS_ORIGIN includes frontend domain
2. Frontend API URL is correct
3. Backend is accessible from frontend container

**Test backend from frontend container:**
```bash
# In frontend terminal
wget -O- http://bunkit-backend:3001/api/health
```

### Database Connection Issues

**Verify:**
1. PostgreSQL is running
2. Database URL is correct
3. Network connectivity between backend and database

**Test connection:**
```bash
# In backend terminal
psql $DATABASE_URL -c "SELECT version();"
```

### SSL/TLS Certificate Issues

1. Ensure DNS is pointing correctly
2. Wait a few minutes for Let's Encrypt provisioning
3. Check Dokploy SSL settings

## Environment-Specific Configurations

### Staging Environment

Create a separate Dokploy project for staging:

1. Deploy to `staging` branch
2. Use different domain: `staging-api.yourdomain.com`
3. Use separate database
4. Lower resource limits

### Production Best Practices

- ✅ Use strong, unique secrets for JWT
- ✅ Enable SSL/TLS for all domains
- ✅ Set `LOG_LEVEL=warn` or `error` in production
- ✅ Configure database backups in Dokploy
- ✅ Set up monitoring and alerts
- ✅ Use separate database for production
- ✅ Implement rate limiting (already included)
- ✅ Review CORS origins regularly

## Updating Your Application

### Deploy New Changes

1. **Push to Git**:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```

2. **Redeploy in Dokploy**:
   - Dokploy can auto-deploy on push (configure webhooks)
   - Or manually click **Redeploy** button

### Database Migrations

Migrations run automatically on backend startup, so when you add new migrations:

1. Commit and push your migration files
2. Redeploy backend in Dokploy
3. Monitor logs to verify migration success
4. Deploy frontend if needed

**Manual migration** (if needed):
```bash
# Access backend terminal in Dokploy
cd apps/backend
bun run db:migrate
```

## Scaling

### Horizontal Scaling

Dokploy supports multiple replicas:

1. Go to application settings
2. Increase **Replicas** count
3. Database connections will be pooled automatically

### Vertical Scaling

Adjust resources:

1. Increase CPU/Memory limits
2. Restart application
3. Monitor performance

## Backup & Disaster Recovery

### Database Backups

1. In Dokploy, go to your database
2. Configure automatic backups
3. Schedule: Daily at minimum
4. Retention: 7-30 days

### Manual Backup

```bash
# Backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

## Cost Optimization

- Use single server for dev/staging
- Scale down when not in use
- Monitor resource usage
- Use connection pooling (already implemented)

## Next Steps

1. ✅ Set up monitoring alerts
2. ✅ Configure automated backups
3. ✅ Set up staging environment
4. ✅ Implement CI/CD pipeline
5. ✅ Add custom domain
6. ✅ Configure CDN (optional, for static assets)

## Support

- **Dokploy Docs**: https://docs.dokploy.com
- **BunKit Issues**: Create issue in your repository
- **Community**: Dokploy Discord/Forum

---

## Option 2: Docker Compose Deployment

If you prefer to deploy everything as a single stack (including PostgreSQL):

### Step 1: Prepare Repository

Same as Option 1 - ensure all files are committed and pushed.

### Step 2: Create Compose Application in Dokploy

1. In Dokploy, go to **Applications** → **Create Application**
2. Choose **Docker Compose** type
3. Configure:
   - **Name**: `bunkit-stack`
   - **Repository**: Connect your Git repository
   - **Branch**: `main`
   - **Compose File Path**: `docker-compose.yml`

### Step 3: Configure Environment Variables

Add these environment variables in Dokploy (they'll be used by docker-compose):

```bash
# PostgreSQL
POSTGRES_PASSWORD=your_secure_postgres_password

# JWT Secrets
JWT_SECRET=your-very-secure-jwt-secret-minimum-32-characters
JWT_REFRESH_SECRET=your-very-secure-refresh-secret-minimum-32-characters

# CORS (add your domain)
CORS_ORIGIN=https://yourdomain.com

# Optional
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
LOG_LEVEL=info
```

### Step 4: Configure Ports

Map the following ports in Dokploy:
- **Frontend**: Port `3000` (from container port `3000`)
- **Backend**: Port `3001` (from container port `3001`)
- **PostgreSQL**: Port `5432` (from container port `5432`) - only if you need external access

### Step 5: Deploy

1. Click **Deploy**
2. Dokploy will:
   - Pull your repository
   - Build both Dockerfiles
   - Start PostgreSQL, backend, and frontend
   - Connect them via Docker network

### Step 6: Verify Deployment

The backend automatically runs migrations on startup. Check the logs to verify:

```bash
# In Dokploy logs, you should see:
🔄 Starting BunKit Backend...
⏳ Waiting for database...
✅ Database ready
📦 Running database migrations...
✅ Migrations completed successfully
🚀 Starting application...
```

If migrations fail, the container won't start and you'll see the error in logs.

### Step 7: Configure Domain

1. Add custom domain to your Compose application
2. Configure SSL/TLS
3. Dokploy will route traffic to the frontend (port 3000)

### Notes for Docker Compose Deployment

- **Data Persistence**: The PostgreSQL volume is named, so data persists across restarts
- **Networking**: All services communicate via Docker's internal network
- **Backups**: You'll need to manually backup the PostgreSQL volume
- **Scaling**: Harder to scale individual services independently
- **Updates**: Redeploying rebuilds all containers

### When to Use Docker Compose Deployment

✅ Good for:
- Simple projects
- Development/staging environments
- Single-server deployments
- When you want everything in one stack

❌ Not ideal for:
- Production with high traffic
- When you need managed database features
- Complex scaling requirements
- Multiple environments with shared databases

---

## Comparison Table

| Feature | Option 1: Separate Services | Option 2: Docker Compose |
|---------|---------------------------|------------------------|
| **Setup Complexity** | Medium | Low |
| **Database Management** | Managed by Dokploy | Self-managed container |
| **Backups** | Automatic | Manual |
| **Scaling** | Easy, independent | Harder, all or nothing |
| **Resource Usage** | Optimized | Higher (separate containers) |
| **Best For** | Production | Dev/Staging |
| **Migration Complexity** | More steps | Fewer steps |
| **Cost** | Lower (shared DB possible) | Higher (dedicated DB) |

---

🎉 **Congratulations!** Your BunKit application is now deployed on Dokploy!
