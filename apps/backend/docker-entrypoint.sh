#!/bin/sh
set -e

echo "🔄 Starting BunKit Backend..."

# Wait for database to be ready (with timeout)
echo "⏳ Waiting for database..."
echo "   DATABASE_URL: $DATABASE_URL"
RETRY_COUNT=0
MAX_RETRIES=30  # 60 seconds total (30 * 2s)

until bun -e "import('postgres').then(m => m.default(process.env.DATABASE_URL)).then(db => db\`SELECT 1\`).then(() => process.exit(0)).catch(() => process.exit(1))" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Database connection timeout after ${MAX_RETRIES} attempts"
    exit 1
  fi
  echo "   Database is unavailable - retrying in 2s... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done
echo "✅ Database ready"

# Run database migrations
echo "📦 Running database migrations..."
cd /app/apps/backend
bun run db:migrate

if [ $? -eq 0 ]; then
  echo "✅ Migrations completed successfully"
else
  echo "❌ Migration failed"
  exit 1
fi

# Start the application
echo "🚀 Starting application..."
exec bun run start
