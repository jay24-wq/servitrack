# Backend Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

## Installation

```bash
cd backend
cp .env.example .env
npm install
```

## Environment Variables

Copy `.env.example` to `.env` dan sesuaikan:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `REDIS_HOST`, `REDIS_PORT`
- `JWT_SECRET`
- `PORT`

## Database Setup

```bash
# Migrate
npm run db:migrate

# Seed (optional)
npm run db:seed
```

## Development

```bash
npm run dev
```

Backend berjalan di `http://localhost:3000`

## Testing

```bash
npm test
npm run lint
```

## Production Build

```bash
npm run build
npm start
```
