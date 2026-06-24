# ServiTrack : Sistem Manajemen Repair Center

ServiTrack adalah sistem manajemen pusat perbaikan elektronik berbasis web yang dirancang untuk meningkatkan transparansi informasi antara penyedia jasa dan pelanggan. Sistem ini mengintegrasikan **check-in digital, nota digital otomatis, kanban board teknisi, live tracking portal, quotation approval, manajemen inventaris suku cadang, dan pembayaran** dalam satu ekosistem.

Platform ini dibangun menggunakan **Laravel 12 (PHP 8.2)** dengan antarmuka modern berbasis **TailwindCSS + Alpine.js**, serta integrasi layanan eksternal seperti **WhatsApp Business API, dan AWS S3** untuk penyimpanan foto dokumentasi.

---

## 🚀 Fitur Utama
- **Check-in Digital**: Penerimaan perangkat dengan identitas pemilik perangkat, identitas perangkat, dokumentasi foto, dan catatan keluhan.
- **Nota Digital Otomatis**: Bukti penerimaan dikirim via WhatsApp/Email segera setelah check-in.
- **Kanban Board Teknisi**: Visualisasi status pekerjaan (Antrian → Pengecekan → Menunggu Part → Pengerjaan → Quality Check → Selesai → Siap Diambil).
- **Live Tracking Portal**: Pelanggan dapat memantau progres perbaikan real-time menggunakan nomor resi tanpa login.
- **Quotation Approval**: Persetujuan biaya tambahan secara digital oleh pelanggan.
- **Manajemen Inventaris**: Pencatatan stok suku cadang, peringatan stok menipis, dan log penggunaan per tiket.
- **Pembayaran & Laporan**: Transaksi akhir dan laporan pendapatan otomatis.

---

## 👥 Pengguna Sistem
- **Administrator / Manajer**: Mengelola data karyawan, manajemen Tiket (Daftar Antrean), laporan pendapatan, dan inventaris.
- **Front Desk**: Melakukan check-in digital, dokumentasi foto, nota digital, dan pembayaran.
- **Teknisi**: Memperbarui status pekerjaan, mencatat kerusakan, mengajukan quotation, dan mencatat penggunaan sparepart.
- **Pelanggan**: Melacak status perbaikan via portal dan menyetujui/menolak quotation.

---

## 💻 Instalasi Lokal (Development)
1. **Kloning repositori**
   ```bash
   git clone https://github.com/jay24-wq/servitrack.git
   cd servitrack
2. **Salin dan konfigurasi environment**
   ```bash
   cp .env.example .env
4. **Unduh dependensi**
   ```bash
   composer install
   npm install
6. **Generate key & migrasi database**
   ```bash
   php artisan key:generate
   php artisan migrate --seed
8. **Kompilasi aset & jalankan server**
   ```bash
   npm run dev
   php artisan serve
