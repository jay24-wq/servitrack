# Setup Scripts for ServiTrack

## Local Development Setup

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)

### Quick Start

```bash
# 1. Start local infrastructure
docker-compose up -d

# 2. Setup backend
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev

# 3. Setup frontend
cd ../frontend
cp .env.example .env
npm install
npm run dev
```

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with auto-reload |
| `npm run build` | Build production bundle |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed database with initial data |
