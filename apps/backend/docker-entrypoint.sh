#!/bin/sh
set -e

echo "🔄 Starting BunKit Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
until bun -e "import('postgres').then(m => m.default(process.env.DATABASE_URL)).then(db => db\`SELECT 1\`).then(() => process.exit(0)).catch(() => process.exit(1))" 2>/dev/null; do
  echo "   Database is unavailable - retrying in 2s..."
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
