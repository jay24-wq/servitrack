type FaqItem = { id: string; question: string; answer: string };
type FaqCategory = { id: string; title: string; questions: FaqItem[] };

export const faqCategories: FaqCategory[] = [
  {
    id: 'umum',
    title: 'Umum & Tentang ServiTrack',
    questions: [
      {
        id: 'apa-itu-servitrack',
        question: 'Apa itu ServiTrack?',
        answer: 'ServiTrack adalah platform manajemen servis elektronik yang memudahkan pelanggan melakukan booking servis online, memantau progres perbaikan secara real-time, melihat estimasi biaya, serta menggunakan layanan pickup dan delivery tanpa harus datang langsung ke workshop.',
      },
      {
        id: 'keamanan-data',
        question: 'Apakah data pelanggan dan perangkat saya aman?',
        answer: 'Data pelanggan dan perangkat disimpan secara terstruktur untuk mendukung proses booking, tracking, dan riwayat servis. Akses data dibatasi berdasarkan hak akses pengguna yang berwenang.',
      },
      {
        id: 'akun-booking-tracking',
        question: 'Apakah saya perlu membuat akun untuk melakukan booking atau melacak servis?',
        answer: 'Tidak wajib. Pelanggan dapat langsung melakukan booking servis maupun mengecek status perbaikan secara publik menggunakan Nomor Resi (Tracking Code) tanpa harus login.',
      },
    ],
  },
  {
    id: 'booking',
    title: 'Booking & Kapasitas Antrian',
    questions: [
      {
        id: 'sistem-antrian',
        question: 'Bagaimana sistem antrian bekerja?',
        answer: 'ServiTrack menggunakan sistem kapasitas harian yang transparan. Pelanggan dapat melihat ketersediaan slot servis sebelum melakukan booking sehingga waktu pengerjaan lebih terkontrol dan tidak perlu menunggu tanpa kepastian.',
      },
      {
        id: 'datang-ke-workshop',
        question: 'Apakah saya harus datang langsung ke workshop?',
        answer: 'Tidak. Anda dapat memilih metode servis sesuai kebutuhan, mulai dari datang langsung ke workshop (Drop-Off), layanan Pickup, maupun Pickup & Delivery. Tim kami akan membantu proses penjemputan dan pengantaran perangkat sesuai jadwal yang dipilih.',
      },
      {
        id: 'membatalkan-booking',
        question: 'Bagaimana jika saya ingin membatalkan booking?',
        answer: 'Booking dapat dibatalkan selama proses servis belum dimulai. Jika perangkat sudah memasuki tahap diagnosa atau perbaikan, kebijakan pembatalan akan mengikuti ketentuan workshop yang berlaku.',
      },
    ],
  },
  {
    id: 'pickup-tracking',
    title: 'Pickup, Delivery & Live Tracking',
    questions: [
      {
        id: 'melacak-status',
        question: 'Bagaimana cara melacak status perangkat saya?',
        answer: 'Setelah booking berhasil dibuat, Anda akan menerima Nomor Resi atau Tracking Code. Nomor tersebut dapat digunakan untuk memantau progres servis mulai dari proses check-in, diagnosa, perbaikan, hingga perangkat selesai dan siap diambil atau diantar kembali.',
      },
      {
        id: 'pickup-delivery',
        question: 'Apakah layanan pickup dan delivery tersedia?',
        answer: 'Ya. Layanan pickup dan delivery tersedia untuk area yang dijangkau workshop. Estimasi ongkir dihitung berdasarkan jarak lokasi pelanggan ke workshop sehingga lebih akurat dan transparan.',
      },
      {
        id: 'update-progres',
        question: 'Apakah saya akan mendapatkan update progres servis?',
        answer: 'Ya. Setiap perubahan status servis dapat dipantau melalui halaman tracking. Workshop juga dapat memberikan pembaruan melalui WhatsApp sesuai proses operasional yang digunakan.',
      },
    ],
  },
  {
    id: 'biaya-pembayaran',
    title: 'Estimasi Biaya, Quotation & Pembayaran',
    questions: [
      {
        id: 'estimasi-biaya',
        question: 'Apakah estimasi biaya yang ditampilkan sudah pasti?',
        answer: 'Estimasi yang ditampilkan merupakan perkiraan biaya berdasarkan jenis perangkat dan kendala yang dipilih. Setelah perangkat diperiksa langsung oleh teknisi, Anda akan menerima hasil diagnosa dan estimasi biaya final sebelum proses perbaikan dilanjutkan.',
      },
      {
        id: 'persetujuan-diagnosa',
        question: 'Bagaimana cara menyetujui atau menolak hasil diagnosa teknisi?',
        answer: 'Setelah teknisi selesai melakukan pengecekan, Anda akan menerima tautan Quotation melalui WhatsApp. Anda dapat meninjau rincian sparepart, biaya jasa, serta estimasi waktu pengerjaan lalu menyetujui atau menolaknya langsung secara online.',
      },
      {
        id: 'metode-pembayaran',
        question: 'Metode pembayaran apa saja yang didukung?',
        answer: 'Pembayaran pelunasan servis dapat dilakukan secara nontunai melalui tautan pembayaran digital (QRIS, Virtual Account, E-Wallet) maupun transfer bank dan pembayaran langsung di workshop sesuai kebijakan tenant.',
      },
    ],
  },
  {
    id: 'pengerjaan-sparepart',
    title: 'Proses Pengerjaan & Suku Cadang',
    questions: [
      {
        id: 'durasi-perbaikan',
        question: 'Berapa lama proses perbaikan berlangsung?',
        answer: 'Durasi pengerjaan bergantung pada jenis kerusakan, tingkat kesulitan perbaikan, dan ketersediaan sparepart.',
      },
      {
        id: 'stok-sparepart',
        question: 'Bagaimana jika suku cadang (sparepart) yang dibutuhkan sedang kosong?',
        answer: 'Jika stok suku cadang belum tersedia di workshop, status tiket akan diperbarui menjadi Menunggu Suku Cadang dan estimasi waktu pemesanan part akan diinformasikan di dalam rincian quotation Anda.',
      },
    ],
  },
];

const serviceFaqIds = new Set([
  'apa-itu-servitrack',
  'datang-ke-workshop',
  'melacak-status',
  'estimasi-biaya',
  'sistem-antrian',
  'update-progres',
  'pickup-delivery',
  'durasi-perbaikan',
  'keamanan-data',
  'membatalkan-booking',
]);

export const serviceFaqs = faqCategories
  .flatMap(({ questions }) => questions)
  .filter(({ id }) => serviceFaqIds.has(id));
