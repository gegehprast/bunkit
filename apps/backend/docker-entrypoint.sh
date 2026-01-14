#!/bin/sh
set -e

echo "🔄 Starting BunKit Backend..."

# Wait for database to be ready (with timeout)
echo "⏳ Waiting for database..."
echo "   DATABASE_URL: $DATABASE_URL"
RETRY_COUNT=0
MAX_RETRIES=30  # 60 seconds total (30 * 2s)

# Create a temporary test script
cat > /tmp/db-test.js << 'EOF'
import { Database } from "bun:sqlite";
import { createConnection } from "node:net";

const url = new URL(process.env.DATABASE_URL);
const host = url.hostname;
const port = url.port || 5432;
const database = url.pathname.slice(1);
const username = url.username;
const password = url.password;

try {
  // Simple TCP connection test
  const socket = createConnection({ host, port, timeout: 2000 });
  
  await new Promise((resolve, reject) => {
    socket.on('connect', () => {
      console.log('✓ TCP connection successful');
      socket.end();
      resolve();
    });
    socket.on('error', reject);
    socket.on('timeout', () => reject(new Error('Connection timeout')));
  });
  
  process.exit(0);
} catch (error) {
  console.error('Connection failed:', error.message);
  process.exit(1);
}
EOF

until bun run /tmp/db-test.js; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "❌ Database connection timeout after ${MAX_RETRIES} attempts"
    rm -f /tmp/db-test.js
    exit 1
  fi
  echo "   Database is unavailable - retrying in 2s... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done

rm -f /tmp/db-test.js
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
