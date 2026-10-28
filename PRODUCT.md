# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Admin/Owner workshop** — pengguna utama layar dashboard. Menjalankan toko servis elektronik kecil–menengah di Indonesia. Pekerjaannya: memastikan uang masuk (omzet, piutang), biaya stok, dan alur kerja bengkel berjalan; membuka dashboard beberapa kali sehari untuk membaca kondisi bisnis sekilas.
- **Frontdesk** — check-in pelanggan, triase antrian masuk, kasir harian, follow-up pembayaran.
- **Teknisi** — papan pengerjaan, update status, membuat quotation biaya tambahan.
- **Kurir** (paket Advance) — daftar tugas jemput/antar, update status lapangan, bukti serah terima.
- **Pelanggan tanpa akun** — booking slot, live tracking, approval quotation lewat WhatsApp. Mayoritas memakai ponsel.

## Product Purpose

Platform SaaS multi-tenant untuk manajemen servis perangkat elektronik: dari booking dan penjemputan unit, check-in digital, papan pengerjaan, approval biaya, pembayaran, sampai garansi. Tujuannya: bengkel kecil bisa beroperasi serapi jaringan besar tanpa menambah staf administrasi. Sukses = pelanggan tahu posisi perangkatnya tanpa menelepon, dan pemilik tahu posisi bisnisnya tanpa membuka buku.

## Positioning

Transparansi yang bisa dibuktikan sebagai mekanisme produk: setiap tahap tercatat (waktu, foto, biaya) dan dipublikasikan ke pelanggan lewat WhatsApp + live tracking dari data yang sama yang dipakai staf. Data pelanggan dan operasional tidak dipisah — satu alur, dua wajah. Bobot: SaaS berlangganan dengan plan guard (Starter / Pro / Advance) dan isolasi tenant per `tenant_id`.

## Operating Context

- Seluruh copy berbahasa Indonesia; nominal Rupiah; waktu WIB.
- Dashboard dipakai di meja frontdesk/owner (desktop) sementara pelanggan, kurir, dan tracking dipakai di ponsel — mobile-first di sisi lapangan.
- Alur inti: booking slot → pickup kurir / dropoff → check-in digital (foto kondisi) → kanban Antrian → Pengecekan → Pengerjaan → Selesai → quotation approval → pembayaran (QRIS/VA/tunai) → garansi 90 hari.
- Suku cadang dikelola dari inventaris; notifikasi otomatis lewat WhatsApp Business API (aktif Pro & Advance).
- Multi-tenant, multi-branch pada paket Advance (Starter dibatasi 3 user & 100 tiket/bulan).
- Ritme: laporan harian/bulanan, cek stok menipis terjadwal, follow-up piutang.

## Capabilities and Constraints

- Modul internal: dashboard, kanban tiket, check-in baru, inventaris parts, invoicing & kasir, laporan.
- Frontend: React 19 + Vite, Tailwind CSS v4, React Router v7, Zustand, TanStack Query, ikon `@phosphor-icons/react`, font Google Sans Flex.
- Plan guard dipegang backend; frontend hanya menyembunyikan menu.
- Belum tersambung API pada layar dashboard: seluruh angka masih mock di dalam komponen (fakta terbuka, bukan klaim).
- Data contoh (nama, nominal, tiket) harus tetap terlihat sebagai contoh, bukan dijadikan klaim komersial.

## Brand Commitments

- Nama **ServiTrack**, tagline "Reparasi Transparan", logo di `frontend/public/logo.png`.
- World visual publik (dipin oleh permintaan pemilik produk): primary sky-600 dengan neutral stone, kartu `rounded-2xl` berbatas stone-100 + shadow halus, badge pil berwarna semantik, ikon Phosphor, font Google Sans Flex. Dashboard internal harus konsisten dengan `frontend/src/pages/public/HomePage.tsx`.
- Ikon wajib Phosphor (bukan Lucide), bahasa Indonesia, dan font Google Sans Flex — ditetapkan pengguna.

## Evidence on Hand

- Acuan visual frame: `frontend/src/pages/public/HomePage.tsx` (homepage, 578 baris) dan halaman publik lain (booking, kapasitas, tracking).
- Titik sentuh dashboard saat ini: `frontend/src/pages/admin/DashboardPage.tsx`, `components/admin/{DashboardLayout,SidebarNav,Topbar}.tsx`, komponen shadcn-ui di `components/ui/`.
- Angka pada dashboard dan homepage bersifat ilustratif (synthetic). Testimoni, harga paket, dan statistik di homepage tidak boleh diubah tanpa persetujuan pengguna.

## Product Principles

1. Transparansi dulu — status, biaya, dan siapa memegang unit selalu terlihat.
2. Satu pandangan untuk uang dan operasional; tidak ada tab yang harus dibuka untuk pertanyaan pertama.
3. Triase menonjol — tiket baru, piutang jatuh tempo, dan stok kritis mendesak perhatian.
4. Padat tapi tenang: kepadatan untuk meja kerja desktop, ketenangan supaya angka tetap terbaca.
5. Konsistensi bahasa visual antar area internal dan publik.

## Accessibility & Inclusion

Belum ada standar formal yang ditetapkan pemilik produk. Ikuti praktik web yang sudah ada di repo: kontras teks stone-500 ke atas pada latar putih, target sentuh ≥ 40px, `focus-visible` terlihat, dan hormati `prefers-reduced-motion` (sudah dipakai di `index.css`).
