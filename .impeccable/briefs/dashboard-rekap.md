# Surface brief — Dashboard Admin & Operasional (ServiTrack)

**Scope:** layar dashboard internal `/dashboard`, untuk Admin/Owner workshop. Visitor mode: **Operate**.
**Audience & job:** Admin/Owner toko servis elektronik; membuka layar beberapa kali sehari untuk membaca uang dan alur bengkel sekilas, mengaudit satu angka ke sumbernya, lalu lompat ke Kanban / Check-in / Invoicing.
**Action:** membaca total minggu, menutup buku hari ini, mengaudit satu total ke baris penyusunnya.
**Content & proof:** 4 total uang (omzet, piutang, kas hari ini, stok kritis), tren pendapatan bulanan, parts terlaris, log aktivitas, tabel tiket dengan badge status. Angka contoh (mock) dan belum tersambung API — dinyatakan di kaki lembar.
**Constraints:** world ServiTrack tetap (sky-600 + stone, kartu `rounded-2xl` berbatas hairline, ikon Phosphor, Google Sans Flex, bahasa Indonesia, nominal Rupiah); homepage & halaman publik tidak disentuh; 6 menu tetap ada.
**Chosen direction:** *Lembar Rekap Mingguan* — dashboard sebagai lembar rekap ber-garis, dengan blok stempel pemeriksaan dan audit angka ke baris.
**Memorable moment:** klik angka → baris penyusunnya ditandai seperti tinta di margin, dan lembar bisa ditutup buku dengan satu cap.
**Unresolved:** sambungan data API dashboard; kebutuhan ekspor PDF laporan mingguan.

## Direction contract

**THESIS:** Dashboard adalah lembar rekap operasional yang ditandatangani owner tiap minggu — uang di kolom, pekerjaan di baris, setiap angka bisa diaudit ke sumbernya. Bentuk yang ditolak: rak kartu metrik seragam yang bisa dipakai produk apa pun.
**OWN-WORLD:** Sky-600 primary + netral stone; kertas putih dengan garis rambut stone-200/100; angka tabular `tabular-nums` untuk semua uang dan hitungan; chip semantik sky/amber/rose/emerald; ikon Phosphor `fill`; Google Sans Flex; blok stempel berupa kotak garis putus-putus dengan cap bulat sebagai tanda pemeriksaan.
**STORY:** Owner membuka layar, dalam beberapa detik tahu uang minggu ini, apa yang masih di bengkel, dan apa yang menuntut perhatian; lalu menutup buku hari ini atau melompat ke Kanban.
**FIRST VIEWPORT:** Strip minggu (rentang tanggal, pencarian, paket, notif, avatar) sebagai kepala lembar; di bawahnya strip empat total uang yang dibagi garis rambut vertikal — angka tabular besar, delta kecil, setiap sel punya jalan audit, blok stempel di ujung kanan. Badan lembar: kiri tabel rekap tiket ber-garis dengan rail rekap per status di atasnya; kanan grafik tren di atas kertas ber-garis, lalu parts terlaris, lalu log aktivitas. Kaki lembar: nomor lembar, total tagihan minggu, tombol Tutup Buku.
**FORM:** kandidat terurut #4 dari tujuh struktur grounded; seed key `57100f87`. Signature interaction: klik satu angka → baris penyusunnya ditandai di margin dan totalnya dicap ulang di kaki lembar.
**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
