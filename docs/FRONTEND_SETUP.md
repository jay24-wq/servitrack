# Frontend Setup Guide

## Prerequisites
- Node.js 18+
- npm or yarn

## Installation

```bash
cd frontend
cp .env.example .env
npm install
```

## Environment Variables

Copy `.env.example` to `.env` dan sesuaikan:
- `VITE_API_URL` (default: `http://localhost:3000/api`)

## Development

```bash
npm run dev
```

Frontend berjalan di `http://localhost:5173`

## Build Production

```bash
npm run build
npm run preview
```

## Testing

```bash
npm run lint
```

## Available Pages

| Route | Page |
|-------|------|
| `/` | Homepage |
| `/booking` | Booking Servis |
| `/kapasitas` | Cek Kapasitas Antrian |
| `/tracking` | Live Tracking |
| `/layanan` | Layanan & Fitur |
| `/login` | Staff Login |
