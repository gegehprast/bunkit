#!/bin/sh
set -e

echo "🔄 Starting BunKit Backend..."

# Wait for database to be ready
echo "⏳ Waiting for database..."
until bun run -e "await fetch('http://localhost:3001').catch(() => {}); const { sql } = await import('postgres'); const db = sql(process.env.DATABASE_URL); try { await db\`SELECT 1\`; console.log('✅ Database ready'); process.exit(0); } catch(e) { process.exit(1); }" 2>/dev/null; do
  echo "   Database is unavailable - retrying in 2s..."
  sleep 2
done

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
