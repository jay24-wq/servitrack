# ServiTrack - Reparasi Transparan

Platform SaaS multi-tenant untuk manajemen servis perangkat elektronik dengan fitur tracking real-time, WhatsApp integration, dan quotation approval digital.

## Stack

### Frontend
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4
- **Router**: React Router v7
- **State**: Zustand
- **Data Fetching**: TanStack Query
- **Icons**: Phosphor Icons

### Backend
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Cache/Queue**: Redis + BullMQ
- **Storage**: S3-compatible (MinIO local)
- **Auth**: JWT + Argon2

### Infrastructure
- **Container**: Docker & Docker Compose
- **Storage**: MinIO (S3-compatible)
- **Monitoring**: Winston (logging)

## Quick Start

```bash
# Start infrastructure
docker-compose up -d

# Backend setup
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed
npm run dev

# Frontend setup
cd ../frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173` untuk akses frontend.

## Struktur Project

```
servitrack/
├── backend/          # Backend API (modular monolith)
├── frontend/         # Frontend SPA (React + Vite)
├── common/           # Shared types & utils
├── docs/             # Documentation
├── scripts/          # Deployment & seed scripts
├── docker-compose.yml
└── .env.example
```

## Fitur Utama

- 📱 Booking slot & tracking real-time
- 📊 Dashboard untuk Admin, Frontdesk, Teknisi, Kurir
- 📱 WhatsApp notification integration
- 💰 Quotation approval digital
- 📦 Inventory management
- 📈 Reports & analytics
- 🔐 RBAC dengan plan guard
- 🌐 Multi-tenant architecture

## License

© 2026 ServiTrack - Kelompok 2 DPBP
