# Installation & Setup

Complete guide to setting up BunKit for development and production environments.

## Prerequisites

### Required Software

- **Bun** >= 1.3.3
  - Install: `curl -fsSL https://bun.sh/install | bash`
  - Verify: `bun --version`

- **PostgreSQL** >= 14
  - macOS: `brew install postgresql@14`
  - Ubuntu: `sudo apt install postgresql-14`
  - Or use Docker: `docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:14`

- **Git** (for cloning)

### Optional Software

- **Node.js** >= 18 (for some dev tools compatibility)
- **Docker** & **Docker Compose** (for containerized deployment)
- **pgAdmin** or **TablePlus** (database GUI tools)

## Quick Start

### 1. Get the Code

```bash
# Clone the repository
git clone <your-repo-url> my-bunkit-app
cd my-bunkit-app

# Or use as GitHub template
# Click "Use this template" on GitHub
```

### 2. Install Dependencies

```bash
# Install all workspace dependencies
bun install
```

This installs dependencies for:
- Root workspace
- Backend application
- Frontend application
- All packages (server, result)

### 3. Database Setup

#### Option A: Local PostgreSQL

```bash
# Create database
createdb bunkit_dev

# Or using psql
psql -U postgres
CREATE DATABASE bunkit_dev;
\q
```

#### Option B: Docker PostgreSQL

```bash
# Start PostgreSQL in Docker
docker run -d \
  --name bunkit-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=bunkit_dev \
  -p 5432:5432 \
  postgres:14
```

#### Option C: Use docker-compose

```bash
# Start all services (PostgreSQL + pgAdmin)
docker-compose up -d postgres

# View logs
docker-compose logs -f postgres
```

### 4. Environment Configuration

Create `apps/backend/.env.local`:

```bash
# Application
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bunkit_dev

# JWT Secrets (CHANGE THESE!)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-key-minimum-32-characters
JWT_REFRESH_EXPIRES_IN=30d

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Logging
LOG_LEVEL=debug
```

**Important**: Generate secure secrets for production:

```bash
# Generate random secrets
bun -e "console.log(crypto.randomBytes(32).toString('hex'))"
```

### 5. Run Database Migrations

```bash
# Generate migration files from schemas
bun run backend:db:generate

# Apply migrations to database
bun run backend:db:migrate
```

### 6. Start Development Servers

#### Terminal 1: Backend

```bash
bun run backend:dev
```

The backend starts at `http://localhost:3001`

#### Terminal 2: Frontend

```bash
bun run frontend:dev
```

The frontend starts at `http://localhost:5173`

### 7. Verify Installation

- Open `http://localhost:5173` in your browser
- You should see the BunKit welcome page
- Try registering a new account
- Check `http://localhost:3001/docs` for API documentation

## Detailed Configuration

### Environment Variables

#### Application Settings

```bash
# Server configuration
NODE_ENV=development          # development | production | test
PORT=3001                     # Server port
HOST=0.0.0.0                 # Bind address (0.0.0.0 for all interfaces)
```

#### Database Configuration

```bash
# PostgreSQL connection string
DATABASE_URL=postgresql://username:password@host:port/database

# Examples:
# Local: postgresql://postgres:postgres@localhost:5432/bunkit_dev
# Docker: postgresql://postgres:postgres@postgres:5432/bunkit
# Cloud: postgresql://user:pass@db.provider.com:5432/production
```

#### Authentication Configuration

```bash
# JWT access tokens
JWT_SECRET=<minimum-32-characters>
JWT_EXPIRES_IN=7d              # 7 days, or: 1h, 30m, 60s

# JWT refresh tokens
JWT_REFRESH_SECRET=<minimum-32-characters>
JWT_REFRESH_EXPIRES_IN=30d     # 30 days

# Password hashing
BCRYPT_ROUNDS=10               # Higher = more secure but slower
```

#### CORS Configuration

```bash
# Allowed origins (comma-separated)
CORS_ORIGIN=http://localhost:3000,http://localhost:5173,https://app.example.com

# For development (allow all origins)
# CORS_ORIGIN=*
```

#### Logging Configuration

```bash
# Log level
LOG_LEVEL=debug                # debug | info | warn | error

# Log format
LOG_FORMAT=json                # json | pretty

# Log to file (optional)
LOG_FILE=./logs/app.log
```

### Database Setup Details

#### Create Development Database

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE bunkit_dev;

-- Create user (optional)
CREATE USER bunkit WITH PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE bunkit_dev TO bunkit;

-- Exit
\q
```

#### Create Test Database

```sql
CREATE DATABASE bunkit_test;
GRANT ALL PRIVILEGES ON DATABASE bunkit_test TO bunkit;
```

#### Database Migrations

```bash
# Generate migrations from schema changes
bun run backend:db:generate

# Review generated SQL in drizzle/0000_*.sql

# Apply migrations
bun run backend:db:migrate

# Open Drizzle Studio (database GUI)
bun run backend:db:studio
```

#### Migration Workflow

1. Modify schemas in `apps/backend/src/db/schemas/`
2. Generate migration: `bun run backend:db:generate`
3. Review SQL in `apps/backend/drizzle/`
4. Apply migration: `bun run backend:db:migrate`

### Frontend Configuration

Create `apps/frontend/.env.local`:

```bash
# API URL
VITE_API_URL=http://localhost:3001

# WebSocket URL
VITE_WS_URL=ws://localhost:3001
```

For production:

```bash
VITE_API_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com
```

## Development Workflow

### Running Services

```bash
# Backend only
bun run backend:dev

# Frontend only
bun run frontend:dev

# Run both (use separate terminals)
bun run backend:dev
bun run frontend:dev
```

### Type Checking

```bash
# Check backend types
bun run backend:typecheck

# Check frontend types
bun run frontend:typecheck

# Check all types
bun run backend:typecheck && bun run frontend:typecheck
```

### Code Quality

```bash
# Lint and format all files
bun run check

# Format only
bun run format

# Lint only
bun run lint
```

### Testing

**IMPORTANT:** Tests must be run from each app/package directory.

```bash
# Run specific package tests
cd apps/backend && bun test

# Run specific test file in specific package
cd apps/backend && bun test apps/backend/tests/auth/auth.service.test.ts

# Run tests in watch mode in specific package
cd apps/backend && bun test --watch
```

### Database Management

```bash
# Generate migrations
bun run backend:db:generate

# Apply migrations
bun run backend:db:migrate

# Open database GUI
bun run backend:db:studio

# Reset database (BE CAREFUL!)
# Drop and recreate database, then run migrations
```

### API Documentation

```bash
# Generate OpenAPI spec
bun run backend:openapi:generate

# Generate and copy to frontend
bun run backend:openapi:generate:to-frontend

# Generate WebSocket types
bun run backend:ws-types:generate

# Generate and copy to frontend
bun run backend:ws-types:generate:to-frontend
```

## Production Setup

### Environment Configuration

Create `apps/backend/.env.production`:

```bash
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Use strong secrets!
JWT_SECRET=<generate-with-crypto.randomBytes>
JWT_REFRESH_SECRET=<generate-with-crypto.randomBytes>

# Production database
DATABASE_URL=postgresql://user:pass@production-db:5432/bunkit

# Production CORS
CORS_ORIGIN=https://app.example.com

# Production logging
LOG_LEVEL=info
LOG_FORMAT=json
```

### Build for Production

```bash
# Build backend (if needed)
cd apps/backend
bun run build  # If you have a build script

# Build frontend
cd apps/frontend
bun run build

# Output: apps/frontend/dist/
```

### Run Production Server

```bash
# Backend
cd apps/backend
NODE_ENV=production bun run src/main.ts

# Or using start script
bun run backend:start
```

### Docker Deployment

See [Deployment Guide](./08-deployment.md) for complete Docker setup.

Quick start:

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Troubleshooting

### Bun Installation Issues

```bash
# Reinstall Bun
curl -fsSL https://bun.sh/install | bash

# Verify installation
bun --version

# Update Bun
bun upgrade
```

### Database Connection Issues

```bash
# Test database connection
psql -U postgres -d bunkit_dev -c "SELECT 1"

# Check PostgreSQL is running
# macOS:
brew services list

# Linux:
systemctl status postgresql

# Docker:
docker ps | grep postgres
```

### Port Already in Use

```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>

# Or change port in .env.local
PORT=3002
```

### Migration Issues

```bash
# Reset migrations (DESTRUCTIVE!)
# 1. Drop database
dropdb bunkit_dev

# 2. Recreate database
createdb bunkit_dev

# 3. Run migrations
bun run backend:db:migrate
```

### Module Not Found Errors

```bash
# Clean install
rm -rf node_modules
bun install

# Clear Bun cache
rm -rf ~/.bun/install/cache

# Reinstall
bun install
```

### Type Generation Issues

```bash
# Regenerate types
bun run backend:openapi:generate:to-frontend
bun run backend:ws-types:generate:to-frontend

# Check generated files
ls -la apps/frontend/src/generated/
```

## VS Code Setup (Recommended)

### Recommended Extensions

- **Biome** (`biomejs.biome`) - Linting and formatting
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`)
- **Error Lens** (`usernamehw.errorlens`)
- **Bun for Visual Studio Code** (`oven.bun-vscode`)

### Settings

Create `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Next Steps

Now that you're set up:

1. Explore [Project Structure](./03-project-structure.md) to understand the codebase
2. Read [@bunkit/server Package](./04-server-package.md) to learn the framework
3. Study [Backend Application](./06-backend-application.md) for patterns and examples
4. Check [Development Workflow](./09-development-workflow.md) for best practices
