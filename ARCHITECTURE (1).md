# Architecture Overview

Dokumen ini adalah gambaran arsitektur sistem manajemen servis perangkat elektronik berbasis SaaS (multi-tenant). Dokumen ini dibuat agar developer atau agent bisa cepat memahami struktur kode, alur data, dan batasan antar komponen. Perbarui dokumen ini setiap kali ada perubahan arsitektur.

## 1. Project Structure

Struktur menggunakan monorepo sederhana. Folder `common/` dipakai bersama oleh frontend dan backend supaya tipe data dan konstanta (misalnya status tiket dan kode paket) tidak ditulis dua kali.

```
[Project Root]/
├── backend/                  # Seluruh kode server-side dan API
│   ├── src/
│   │   ├── api/              # Route dan controller (dikelompokkan per modul)
│   │   │   ├── public/       # Endpoint tanpa login: booking, tracking, pickup/dropoff
│   │   │   ├── auth/         # Login staff, refresh token
│   │   │   ├── tickets/      # Manajemen tiket servis dan check-in digital
│   │   │   ├── kanban/       # Perubahan status tiket oleh teknisi
│   │   │   ├── quotations/   # Penawaran biaya tambahan dan approval
│   │   │   ├── inventory/    # Stok suku cadang dan log penggunaan
│   │   │   ├── payments/     # Pembayaran tiket dan billing langganan
│   │   │   ├── reports/      # Laporan pendapatan dan statistik
│   │   │   ├── staff/        # Manajemen staff dan role
│   │   │   ├── chat/         # Chat internal per tiket
│   │   │   ├── courier/      # Modul kurir lapangan (paket Advance)
│   │   │   └── webhooks/     # Callback WhatsApp dan payment gateway
│   │   ├── client/           # Business logic dan integrasi layanan eksternal
│   │   │   ├── services/     # Logika bisnis (TicketService, BookingService, dst.)
│   │   │   ├── whatsapp/     # Wrapper WhatsApp provider
│   │   │   ├── payment/      # Wrapper payment gateway
│   │   │   └── storage/      # Wrapper object storage untuk foto
│   │   ├── jobs/             # Background job (kirim WA, cek stok, generate laporan)
│   │   ├── middleware/       # Auth, tenant resolver, plan guard, rate limiter
│   │   ├── models/           # Skema database dan migration
│   │   └── utils/            # Helper (generator kode tiket, format nomor HP, dll.)
│   ├── config/               # Konfigurasi (env, plan limits, feature flags)
│   ├── tests/                # Unit dan integration test
│   └── Dockerfile
├── frontend/                 # Seluruh kode client-side
│   ├── src/
│   │   ├── components/       # Komponen UI reusable (Button, Modal, StatusBadge, dll.)
│   │   ├── pages/
│   │   │   ├── public/       # Home, Booking, Tracking, Pickup/Dropoff
│   │   │   ├── admin/        # Dashboard, Tiket, Inventaris, Staff, Payment, Reports
│   │   │   ├── frontdesk/    # Check-in digital, Nota, Payment, Tiket
│   │   │   ├── technician/   # Kanban board, Chat
│   │   │   └── courier/      # Daftar tugas jemput/antar (paket Advance)
│   │   ├── assets/           # Gambar, font, ikon
│   │   ├── services/         # API client dan koneksi WebSocket
│   │   └── store/            # State management (auth, tenant, UI)
│   ├── public/
│   ├── tests/                # Unit dan E2E test
│   └── package.json
├── common/                   # Kode bersama frontend dan backend
│   ├── types/                # Interface TypeScript (Ticket, Quotation, Plan, dll.)
│   └── utils/                # Konstanta status tiket, validator, helper umum
├── docs/                     # Dokumentasi (API docs, ERD, panduan setup)
├── scripts/                  # Script deployment dan seeding data
├── .github/                  # GitHub Actions (CI/CD)
├── .gitignore
├── README.md
└── ARCHITECTURE.md           # Dokumen ini
```

## 2. High-Level System Diagram

Sistem memiliki dua jenis pengguna. Pelanggan mengakses halaman publik tanpa akun. Staff (admin, frontdesk, teknisi, kurir) mengakses panel internal setelah login.

```
                        ┌──────────────────────────────────────────────┐
 [Pelanggan]  ────────► │  Frontend: Halaman Publik (tanpa login)      │
 (booking, tracking,    │  Home, Booking, Tracking, Pickup/Dropoff     │
  pickup/dropoff,       └───────────────┬──────────────────────────────┘
  approval via link WA)                 │ REST
                                        ▼
 [Admin/Frontdesk/      ┌──────────────────────────────────────────────┐
  Teknisi/Kurir] ─────► │  Frontend: Panel Internal (login + role)     │
                        └───────────────┬──────────────────────────────┘
                                        │ REST + WebSocket
                                        ▼
                        ┌──────────────────────────────────────────────┐
                        │  Backend API (Node.js)                       │
                        │  Middleware: Auth → Tenant → Plan Guard      │
                        │  Modul: Ticket, Booking, Kanban, Quotation,  │
                        │  Inventory, Payment, Report, Chat, Courier   │
                        └──┬─────────┬──────────┬───────────┬──────────┘
                           │         │          │           │
                           ▼         ▼          ▼           ▼
                    [PostgreSQL]  [Redis]  [Object      [Job Worker]
                    data utama    cache,   Storage]     antrian kirim WA,
                                  queue,   foto         cek stok,
                                  pub/sub  perangkat    generate laporan
                                                              │
                                           ┌──────────────────┼──────────────┐
                                           ▼                  ▼              ▼
                                    [WhatsApp API]    [Payment Gateway]  [Maps/Geocoding]
                                    nota, quotation,  QRIS, VA, e-wallet  alamat jemput
                                    notifikasi status
```

### Alur data utama

**Booking tanpa akun**
1. Pelanggan membuka Home lalu memilih tanggal, jenis layanan (antar-jemput, pickup saja, atau dropoff langsung), dan mengisi data singkat (nama, nomor WhatsApp, perangkat, keluhan).
2. Backend memeriksa kuota slot pada tanggal tersebut lalu membuat data `bookings` dan kode booking.
3. Kode booking dan tautan tracking dikirim lewat WhatsApp.

**Check-in digital dan nota**
1. Frontdesk membuka booking atau membuat tiket baru untuk pelanggan walk-in.
2. Frontdesk mengisi identitas pemilik, identitas perangkat (merek, model, serial/IMEI), foto kondisi perangkat, dan catatan keluhan.
3. Sistem membuat tiket servis dengan status awal `Antrian` lalu membuat nota digital (PDF atau halaman web).
4. Job worker mengirim nota ke WhatsApp pelanggan segera setelah check-in selesai.

**Pengerjaan dan quotation approval**
1. Teknisi memindahkan kartu tiket di kanban board. Setiap perpindahan dicatat di `ticket_status_logs` dan disiarkan lewat WebSocket.
2. Jika ada biaya tambahan, teknisi atau frontdesk membuat quotation. Sistem mengirim tautan approval berisi token sekali pakai ke WhatsApp pelanggan.
3. Pelanggan menyetujui atau menolak lewat halaman tanpa login. Status quotation berubah dan teknisi mendapat notifikasi.

**Pembayaran**
1. Tiket masuk status `Siap Diambil`, frontdesk membuat transaksi pembayaran.
2. Pembayaran tunai dicatat manual. Pembayaran non-tunai diproses lewat payment gateway dan dikonfirmasi lewat webhook.
3. Data transaksi masuk ke laporan pendapatan secara otomatis.

## 3. Core Components

### 3.1. Frontend

**Name:** Web App (Single Page Application, responsive)

**Description:** Satu aplikasi web dengan dua area. Area publik untuk pelanggan (booking, live tracking, pickup/dropoff, halaman approval quotation) tidak memerlukan login. Area internal untuk staff dipisah berdasarkan role dengan route guard. Desain mobile-first karena pelanggan dan kurir kebanyakan memakai ponsel.

| Role | Fitur |
|---|---|
| Pelanggan (tanpa akun) | Booking antrian berdasarkan tanggal, live tracking, pilih pickup/dropoff, approval quotation |
| Admin | Dashboard, management tiket servis, management inventaris, management staff, payment, reports |
| Frontdesk | Check-in digital, nota digital, payment, management tiket |
| Teknisi | Kanban board teknisi, chat |
| Kurir (paket Advance) | Daftar tugas jemput dan antar, update status lapangan, bukti serah terima |

**Technologies:** React (Vite) + TypeScript, Tailwind CSS, React Router, TanStack Query untuk data fetching, Zustand untuk state, `dnd-kit` untuk drag and drop kanban, `socket.io-client` untuk update real-time.

**Deployment:** Vercel, Netlify, atau Cloudflare Pages (static hosting dengan CDN).

### 3.2. Backend Services

Backend dibuat sebagai modular monolith. Satu aplikasi dengan modul yang terpisah jelas supaya mudah dikembangkan oleh tim kecil. Pemisahan menjadi microservices baru dipertimbangkan kalau beban sudah menuntut (lihat bagian 9).

#### 3.2.1. Core API Service

**Name:** Core API

**Description:** Menangani autentikasi staff, manajemen tenant (toko), tiket servis, booking, check-in, kanban, quotation, inventaris, pembayaran, laporan, staff, dan chat. Semua query data otomatis difilter berdasarkan `tenant_id` dan `branch_id` lewat middleware.

**Technologies:** Node.js + TypeScript (NestJS atau Express), Prisma atau Knex sebagai ORM/query builder, Socket.IO, Zod untuk validasi input.

**Deployment:** Container Docker di VPS, AWS ECS, atau Google Cloud Run.

#### 3.2.2. Public API (Guest Access)

**Name:** Public API

**Description:** Kelompok endpoint tanpa login untuk booking, tracking, dan pickup/dropoff. Karena tidak ada akun, keamanan bertumpu pada kode tracking acak dan verifikasi nomor WhatsApp. Endpoint ini dibatasi rate limit dan hanya mengembalikan data minimal (status, perkiraan selesai, nama perangkat), tidak pernah data pribadi lengkap.

**Technologies:** Satu codebase dengan Core API, tetapi memakai middleware berbeda (tanpa JWT, dengan rate limiter dan captcha).

**Deployment:** Sama dengan Core API.

#### 3.2.3. Notification and Job Worker

**Name:** Worker

**Description:** Memproses tugas di belakang layar lewat antrian: mengirim nota dan notifikasi WhatsApp (dengan retry bila gagal), mengirim link quotation, mengecek stok menipis secara terjadwal, membuat laporan harian/bulanan, dan mengecek masa aktif langganan.

**Technologies:** BullMQ + Redis, node-cron untuk jadwal.

**Deployment:** Container terpisah dari Core API supaya bisa di-scale sendiri.

#### 3.2.4. Daftar modul dan endpoint utama

| Modul | Contoh endpoint | Akses |
|---|---|---|
| Booking | `GET /public/slots?date=`, `POST /public/bookings` | Publik |
| Tracking | `POST /public/tracking` (kode + verifikasi), `GET /public/tracking/:token` | Publik |
| Quotation | `GET /public/quotations/:token`, `POST /public/quotations/:token/decision` | Publik (token) |
| Tiket | `POST /tickets`, `GET /tickets`, `PATCH /tickets/:id` | Admin, Frontdesk |
| Kanban | `PATCH /tickets/:id/status`, `GET /kanban` | Teknisi |
| Inventaris | `GET /inventory/parts`, `POST /inventory/usage` | Admin, Teknisi |
| Payment | `POST /payments`, `POST /webhooks/payment` | Admin, Frontdesk |
| Reports | `GET /reports/revenue?from=&to=` | Admin |
| Staff | `POST /staff`, `PATCH /staff/:id` | Admin |
| Kurir | `GET /courier/tasks`, `PATCH /courier/tasks/:id` | Kurir (Advance) |

## 4. Data Stores

### 4.1. Primary Database

**Name:** Primary Database

**Type:** PostgreSQL (MySQL tetap bisa dipakai karena skema bersifat relasional standar)

**Purpose:** Menyimpan seluruh data transaksional dan master. Pendekatan multi-tenant memakai satu database dengan kolom `tenant_id` di setiap tabel bisnis. Opsi tambahan Row Level Security (RLS) PostgreSQL dapat dipakai sebagai lapisan pengaman agar data antar toko tidak bocor.

**Key Schemas/Collections:**
- `tenants`, `subscriptions`, `plans` (data toko dan paket langganan)
- `branches` (cabang, aktif penuh di paket Advance)
- `users`, `roles` (admin, frontdesk, teknisi, kurir)
- `customers` (data pelanggan, dibuat otomatis dari nomor WhatsApp, bukan akun login)
- `devices` (identitas perangkat)
- `bookings`, `booking_slots`
- `service_tickets`, `ticket_status_logs`, `ticket_photos`, `ticket_notes`
- `pickup_dropoff_requests`, `courier_tasks`
- `quotations`, `quotation_items`
- `parts`, `part_stock_movements`, `ticket_part_usages`
- `payments`, `invoices`
- `chat_messages`
- `notification_logs` (riwayat pesan WhatsApp)
- `audit_logs`

**Catatan status tiket:** Status internal (Antrian, Pengecekan, Menunggu Part, Pengerjaan, Quality Check, Selesai, Siap Diambil) disimpan lengkap. Halaman tracking publik bisa menampilkan versi yang lebih ringkas lewat mapping di `common/utils`.

### 4.2. Cache and Queue

**Name:** Cache, Queue, and Pub/Sub

**Type:** Redis

**Purpose:** Menyimpan antrian job (BullMQ), cache hitungan kuota slot booking, rate limiting endpoint publik, dan pub/sub untuk menyiarkan update kanban dan chat ke banyak instance server lewat Socket.IO adapter.

### 4.3. Object Storage

**Name:** File Storage

**Type:** S3-compatible (AWS S3, Cloudflare R2, atau MinIO untuk self-host)

**Purpose:** Menyimpan foto dokumentasi perangkat saat check-in, bukti serah terima kurir, dan file PDF nota. Akses file memakai signed URL berumur pendek. Foto dikompres di sisi client sebelum diunggah.

## 5. External Integrations / APIs

**WhatsApp Business API**
- Purpose: Mengirim nota digital, kode booking, notifikasi perubahan status, dan link approval quotation.
- Integration Method: REST API. Pilihan resmi adalah WhatsApp Business Cloud API milik Meta. Alternatif adalah penyedia lokal seperti Fonnte atau Qontak. Wrapper dibuat dalam satu interface (`WhatsAppProvider`) supaya provider mudah diganti.
- Catatan: Pesan yang dikirim pertama kali ke pelanggan di luar jendela percakapan harus memakai template pesan yang disetujui provider. Fitur ini hanya aktif untuk paket Pro dan Advance.

**Payment Gateway (contoh: Midtrans atau Xendit)**
- Purpose: Pembayaran tiket oleh pelanggan (QRIS, virtual account, e-wallet) dan penagihan langganan bulanan toko.
- Integration Method: REST API dan webhook. Setiap webhook diverifikasi dengan signature dan diproses secara idempotent.

**Maps / Geocoding API (contoh: Google Maps atau OpenStreetMap Nominatim)**
- Purpose: Autocomplete alamat jemput dan pembuatan tautan navigasi untuk kurir.
- Integration Method: REST API / SDK.

**Email Service (opsional, contoh: SendGrid atau Resend)**
- Purpose: Reset password staff dan invoice langganan ke admin toko.
- Integration Method: REST API.

## 6. Deployment & Infrastructure

**Cloud Provider:** Fleksibel. Rekomendasi awal VPS (misalnya di region Indonesia/Singapura) atau AWS/GCP bila butuh managed service.

**Key Services Used:** Container runtime (Docker), managed PostgreSQL, managed Redis, object storage S3-compatible, CDN untuk frontend, reverse proxy (Nginx atau Caddy) dengan HTTPS otomatis.

**CI/CD Pipeline:** GitHub Actions dengan tahapan lint, test, build image, lalu deploy otomatis ke staging dan deploy manual (dengan approval) ke production. Migration database dijalankan sebagai langkah terpisah sebelum aplikasi baru aktif.

**Monitoring & Logging:** Sentry untuk error tracking frontend dan backend, Prometheus + Grafana atau layanan monitoring bawaan cloud untuk metrik, log terstruktur (pino) yang dikirim ke Loki atau CloudWatch. Pantau juga tingkat keberhasilan pengiriman WhatsApp dan panjang antrian job.

### Pembatasan paket langganan (Plan Guard)

Pembatasan paket diterapkan di backend lewat middleware `planGuard` dan konfigurasi di `backend/config/plans`. Frontend hanya menyembunyikan menu, backend tetap menjadi penjaga utama.

| Aspek | Starter | Pro | Advance |
|---|---|---|---|
| Jumlah user | Maksimal 3 (Admin, Frontdesk, Teknisi) | Tidak terbatas | Tidak terbatas |
| Kuota servis per bulan | 100 tiket | Tidak terbatas | Tidak terbatas |
| Fitur operasional dasar | Ya | Ya | Ya |
| Notifikasi WhatsApp otomatis | Tidak | Ya | Ya |
| Quotation Approval digital | Tidak | Ya | Ya |
| Multi-Branch | Tidak | Tidak | Ya |
| Modul Kurir lapangan | Tidak | Tidak | Ya |

**Aturan penting:**
- Saat kuota 100 tiket tercapai di paket Starter, pembuatan tiket baru ditolak dengan pesan yang mengarahkan upgrade. Data lama tetap bisa diakses.
- Jika langganan lewat jatuh tempo, tenant masuk masa tenggang (grace period) dalam mode baca saja sebelum akses ditutup. Data tidak dihapus.
- Downgrade paket ditolak bila jumlah user atau cabang saat ini melebihi batas paket tujuan.

## 7. Security Considerations

**Authentication:**
- Staff: login email dan password (hash Argon2 atau bcrypt) dengan JWT access token berumur pendek dan refresh token yang dirotasi.
- Pelanggan tanpa akun: akses lewat kode tracking acak (minimal 8 karakter, tidak berurutan) ditambah verifikasi 4 digit terakhir nomor WhatsApp. Link approval quotation memakai token acak sekali pakai dengan masa berlaku terbatas.

**Authorization:** RBAC berdasarkan role (Admin, Frontdesk, Teknisi, Kurir) ditambah pembatasan per tenant dan per cabang. Setiap query wajib membawa `tenant_id` dari konteks login, bukan dari input client.

**Data Encryption:** TLS untuk semua koneksi. Enkripsi at rest untuk database dan object storage. Data sensitif seperti nomor identitas pemilik perangkat dienkripsi di level kolom bila disimpan.

**Key Security Tools/Practices:**
- Rate limiting dan captcha pada endpoint publik untuk mencegah spam booking dan brute force kode tracking
- Validasi input dengan Zod, upload foto dibatasi tipe dan ukuran file
- Signed URL berumur pendek untuk foto dan nota
- Verifikasi signature pada webhook WhatsApp dan payment gateway
- Audit log untuk aksi sensitif (ubah harga, hapus tiket, ubah stok, ubah role)
- Halaman tracking publik tidak menampilkan data pribadi lengkap
- Kepatuhan terhadap UU Pelindungan Data Pribadi (UU PDP) di Indonesia, termasuk kebijakan retensi data pelanggan
- Backup database terjadwal dan uji restore berkala

## 8. Development & Testing Environment

**Local Setup Instructions:** Lihat `CONTRIBUTING.md` atau ringkasan berikut.
1. Clone repository lalu salin `.env.example` menjadi `.env` di `backend/` dan `frontend/`.
2. Jalankan `docker compose up -d` untuk PostgreSQL, Redis, dan MinIO lokal.
3. Jalankan migration dan seeder dari folder `scripts/`.
4. Jalankan backend dan frontend dengan perintah `dev` masing-masing.
5. Untuk uji WhatsApp dan payment gunakan mode sandbox atau mock provider.

**Testing Frameworks:** Vitest atau Jest (unit dan integration backend), React Testing Library (komponen), Playwright (E2E untuk alur booking, check-in, kanban, dan approval).

**Code Quality Tools:** ESLint, Prettier, TypeScript strict mode, Husky + lint-staged untuk pre-commit, SonarQube atau CodeQL di CI.

## 9. Future Considerations / Roadmap

- Alur kurir belum memiliki rancangan detail. Perlu ditentukan: penugasan manual atau otomatis, bukti serah terima (foto, tanda tangan, atau OTP), pelacakan lokasi (real-time atau cukup update status), dan penanganan pelanggan yang tidak ada di lokasi.
- Keputusan teknologi yang masih terbuka: React atau Vue, Node.js atau Laravel, PostgreSQL atau MySQL. Dokumen ini memakai React, Node.js, dan PostgreSQL sebagai acuan. Bila diganti, bagian 3, 4, dan 8 perlu disesuaikan.
- Pertimbangkan Server-Sent Events atau polling ringan untuk halaman tracking publik agar tidak membebani WebSocket dengan banyak koneksi anonim.
- Evaluasi pemisahan modul Notification dan Payment menjadi service terpisah bila volume pesan meningkat.
- Tambahan fitur yang mungkin: garansi servis dan klaim ulang, survei kepuasan setelah servis, integrasi marketplace suku cadang, serta aplikasi mobile untuk kurir.
- Strategi migrasi tenant besar ke database terpisah bila diperlukan isolasi data lebih ketat.

## 10. Project Identification

**Project Name:** ServiTrack

**Repository URL:** https://github.com/jay24-wq/ServiTrackk

**Primary Contact/Team:** Kelompok 2 DPBP

**Date of Last Update:** 2026-10-06

## 11. Glossary / Acronyms

- **Tenant:** Satu toko servis yang berlangganan sistem ini. Data antar tenant terpisah.
- **Branch:** Cabang dari satu tenant (paket Advance).
- **Tiket Servis:** Catatan satu pekerjaan servis dari perangkat diterima sampai diambil pelanggan.
- **Check-in Digital:** Proses penerimaan perangkat oleh frontdesk yang mencakup identitas pemilik, identitas perangkat, foto, dan catatan keluhan.
- **Nota Digital:** Bukti penerimaan perangkat yang dikirim otomatis lewat WhatsApp setelah check-in.
- **Quotation:** Penawaran biaya tambahan yang harus disetujui pelanggan sebelum pengerjaan dilanjutkan.
- **Kanban Board:** Papan visual status pekerjaan teknisi (Antrian, Pengecekan, Menunggu Part, Pengerjaan, Quality Check, Selesai, Siap Diambil).
- **Pickup:** Perangkat dijemput kurir toko dari lokasi pelanggan.
- **Dropoff:** Pelanggan membawa langsung perangkat ke toko.
- **Antar-Jemput:** Kombinasi pickup saat awal dan pengantaran kembali setelah selesai.
- **Guest Access:** Akses pelanggan tanpa membuat akun, memakai kode tracking dan verifikasi nomor WhatsApp.
- **Plan Guard:** Middleware yang membatasi fitur dan kuota sesuai paket langganan.
- **RBAC:** Role-Based Access Control, pembatasan hak akses berdasarkan peran.
- **RLS:** Row Level Security, fitur PostgreSQL untuk membatasi baris data yang bisa diakses.
- **SaaS:** Software as a Service, perangkat lunak yang dijual dengan sistem berlangganan.
- **UU PDP:** Undang-Undang Pelindungan Data Pribadi.
