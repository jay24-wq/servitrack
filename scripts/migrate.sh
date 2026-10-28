#!/bin/bash
# Database migration runner for ServiTrack

cd "$(dirname "$0")/.."

echo "🚀 Running database migrations..."
cd backend
npx knex migrate:latest
echo "✅ Migrations completed"

echo "seed database..."
npx knex seed:run
echo "✅ Seeds completed"
