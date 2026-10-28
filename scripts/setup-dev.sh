#!/bin/bash
# Setup local development environment for ServiTrack

set -e

echo "🔍 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed. Please install Node.js 18+"
  exit 1
fi
echo "✅ Node.js $(node --version) found"

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "❌ Docker is not installed. Please install Docker"
  exit 1
fi
echo "✅ Docker found"

# Check docker-compose
if ! command -v docker-compose &> /dev/null; then
  if ! command -v docker &> /dev/null && docker compose version &> /dev/null; then
    echo "✅ Docker Compose V2 found"
  else
    echo "❌ Docker Compose is not installed. Please install Docker Compose"
    exit 1
  fi
fi

echo "🚀 Starting local infrastructure..."

cd "$(dirname "$0")/.."

if docker-compose up -d; then
  echo "✅ Infrastructure started successfully"
  echo "⏳ Waiting for services to be ready..."
  sleep 10
  echo "✅ Ready! Now run:"
  echo "   cd backend && cp .env.example .env && npm install && npm run db:migrate && npm run db:seed && npm run dev"
  echo "   cd frontend && cp .env.example .env && npm install && npm run dev"
else
  echo "❌ Failed to start infrastructure. Check docker logs."
  exit 1
fi
