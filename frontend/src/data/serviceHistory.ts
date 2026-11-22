export type HistoryEndStatus = 'Selesai' | 'Siap Diambil' | 'Batal / Ditolak' | 'Garansi';

export interface HistoryPart {
  name: string;
  qty: number;
}

export interface ServiceHistory {
  id: string;
  model: string;
  customer: string;
  complaint: string;
  parts: HistoryPart[];
  finalNote: string;
  /** hari berlalu dari hari ini; dipakai agar filter waktu tetap relevan */
  daysAgo: number;
  endStatus: HistoryEndStatus;
  technician: string;
  repairMinutes: number;
}

export const HISTORY_END_STATUSES: HistoryEndStatus[] = ['Selesai', 'Siap Diambil', 'Batal / Ditolak', 'Garansi'];

export const SUCCESS_STATUSES: HistoryEndStatus[] = ['Selesai', 'Siap Diambil', 'Garansi'];

export const SERVICE_HISTORY: ServiceHistory[] = [
  {
    id: 'SRV0329104756',
    model: 'ASUS ROG Strix G15',
    customer: 'Rafi Mahendra',
    complaint: 'Charging tidak masuk, indikator kedip.',
    parts: [{ name: 'IC Power Asus ROG PM8150', qty: 1 }],
    finalNote: 'Ganti IC power, jalur VCore di-reball, charging normal di 65W.',
    daysAgo: 0,
    endStatus: 'Siap Diambil',
    technician: 'Panendra Soma',
    repairMinutes: 150,
  },
  {
    id: 'SRV0471258934',
    model: 'iPhone 14 Pro',
    customer: 'Dewi Anggraini',
    complaint: 'Baterai cepat habis & kembung.',
    parts: [{ name: 'Baterai iPhone 14 Pro', qty: 1 }],
    finalNote: 'Ganti baterai + seal ulang, health 100%, water-resist terpasang.',
    daysAgo: 0,
    endStatus: 'Selesai',
    technician: 'Panendra Soma',
    repairMinutes: 95,
  },
  {
    id: 'SRV0364810273',
    model: 'Apple MacBook Air M2 13"',
    customer: 'Lestari Dewanti',
    complaint: 'Beberapa tombol keyboard tidak berfungsi.',
    parts: [{ name: 'Keyboard MacBook Pro M1', qty: 1 }],
    finalNote: 'Ganti keyboard module, semua tombol teruji normal.',
    daysAgo: 1,
    endStatus: 'Selesai',
    technician: 'Panendra Soma',
    repairMinutes: 180,
  },
  {
    id: 'SRV0192837465',
    model: 'Lenovo ThinkPad X1 Carbon Gen 9',
    customer: 'Bambang Irawan',
    complaint: 'Overheat dan kipas berisik.',
    parts: [
      { name: 'Thermal Paste Arctic MX-4 4g', qty: 1 },
      { name: 'Fan Cooling Module ThinkPad X1', qty: 1 },
    ],
    finalNote: 'Bersih heatsink, repaste, ganti fan. Suhu idle turun 18°C.',
    daysAgo: 2,
    endStatus: 'Selesai',
    technician: 'Panendra Soma',
    repairMinutes: 120,
  },
  {
    id: 'SRV0551029384',
    model: 'Samsung Galaxy S24 Ultra',
    customer: 'Maya Kusuma',
    complaint: 'Layar bergaris setelah terjatuh.',
    parts: [{ name: 'LCD Samsung S24 Ultra', qty: 1 }],
    finalNote: 'Ganti LCD fullset, touch & display normal. Pelanggan klaim garansi flex.',
    daysAgo: 3,
    endStatus: 'Garansi',
    technician: 'Panendra Soma',
    repairMinutes: 210,
  },
  {
    id: 'SRV0817374650',
    model: 'HP Spectre x360 14',
    customer: 'Hendra Gunawan',
    complaint: 'Unit tidak menyala sama sekali.',
    parts: [{ name: 'IC Power PMIC', qty: 1 }],
    finalNote: 'Perbaikan jalur power + ganti PMIC, unit menyala normal.',
    daysAgo: 4,
    endStatus: 'Selesai',
    technician: 'Panendra Soma',
    repairMinutes: 300,
  },
  {
    id: 'SRV0273640518',
    model: 'Poco X3 Pro',
    customer: 'Siska Putri',
    complaint: 'Mati total setelah kena air.',
    parts: [],
    finalNote: 'Diagnosa: mainboard korosi berat. Pelanggan menolak biaya perbaikan.',
    daysAgo: 6,
    endStatus: 'Batal / Ditolak',
    technician: 'Panendra Soma',
    repairMinutes: 60,
  },
  {
    id: 'SRV0638492017',
    model: 'Dell XPS 15 9520 OLED',
    customer: 'Clara Melisa',
    complaint: 'Blue screen saat menjalankan aplikasi grafis.',
    parts: [],
    finalNote: 'Perlu ganti GPU board; estimasi tinggi, pelanggan membatalkan.',
    daysAgo: 8,
    endStatus: 'Batal / Ditolak',
    technician: 'Panendra Soma',
    repairMinutes: 45,
  },
  {
    id: 'SRV0918273645',
    model: 'ASUS ZenBook 14 OLED',
    customer: 'Yusuf Maulana',
    complaint: 'Keyboard beberapa tombol mati.',
    parts: [{ name: 'Keyboard Module ASUS ZenBook 14', qty: 1 }],
    finalNote: 'Ganti keyboard module, seluruh tombol terverifikasi.',
    daysAgo: 10,
    endStatus: 'Selesai',
    technician: 'Panendra Soma',
    repairMinutes: 160,
  },
  {
    id: 'SRV0418293765',
    model: 'iPhone 13',
    customer: 'Angga Santos',
    complaint: 'Baterai drop cepat.',
    parts: [{ name: 'Baterai iPhone 13', qty: 1 }],
    finalNote: 'Ganti baterai, health 100%, siap diambil pelanggan.',
    daysAgo: 12,
    endStatus: 'Siap Diambil',
    technician: 'Panendra Soma',
    repairMinutes: 90,
  },
  {
    id: 'SRV0736451029',
    model: 'MacBook Pro M1 14"',
    customer: 'Rizal Fadillah',
    complaint: 'Layar berkedip pada sudut tertentu (flexgate).',
    parts: [
      { name: 'LCD MacBook Pro 14"', qty: 1 },
      { name: 'Flex Display', qty: 1 },
    ],
    finalNote: 'Ganti flex + LCD, unit masuk kembali untuk klaim garansi konektor.',
    daysAgo: 15,
    endStatus: 'Garansi',
    technician: 'Panendra Soma',
    repairMinutes: 260,
  },
  {
    id: 'SRV0284756391',
    model: 'PC Rakitan Gaming',
    customer: 'Budi Santoso',
    complaint: 'Upgrade penyimpanan & reinstall OS.',
    parts: [{ name: 'SSD NVMe 1TB', qty: 1 }],
    finalNote: 'Pasang SSD 1TB, clone OS, benchmark normal.',
    daysAgo: 20,
    endStatus: 'Selesai',
    technician: 'Panendra Soma',
    repairMinutes: 140,
  },
  {
    id: 'SRV0564738291',
    model: 'iPad Pro 11"',
    customer: 'Nadia Pramesti',
    complaint: 'LCD pecah setelah jatuh.',
    parts: [{ name: 'LCD iPad Pro 11"', qty: 1 }],
    finalNote: 'Ganti LCD, touch & True Tone normal.',
    daysAgo: 25,
    endStatus: 'Selesai',
    technician: 'Panendra Soma',
    repairMinutes: 200,
  },
  {
    id: 'SRV0391827465',
    model: 'Lenovo IdeaPad Slim 5',
    customer: 'Rizal Fadillah',
    complaint: 'Upgrade SSD & reinstall sistem.',
    parts: [{ name: 'SSD SATA 512GB', qty: 1 }],
    finalNote: 'Upgrade SSD, reinstall OS + driver, unit responsif.',
    daysAgo: 30,
    endStatus: 'Selesai',
    technician: 'Panendra Soma',
    repairMinutes: 120,
  },
  {
    id: 'SRV0172635480',
    model: 'Samsung Galaxy A51',
    customer: 'Putri Amelia',
    complaint: 'Layar retak & baterai boros.',
    parts: [
      { name: 'LCD Samsung A51', qty: 1 },
      { name: 'Baterai Samsung A51', qty: 1 },
    ],
    finalNote: 'Ganti LCD + baterai, uji fungsi menyeluruh lulus.',
    daysAgo: 40,
    endStatus: 'Selesai',
    technician: 'Panendra Soma',
    repairMinutes: 175,
  },
  {
    id: 'SRV0648291037',
    model: 'Xiaomi Redmi Note 12',
    customer: 'Fajar Nugroho',
    complaint: 'Konektor cas rusak / patah.',
    parts: [],
    finalNote: 'Perlu ganti sub-board; pelanggan menolak, unit dikembalikan.',
    daysAgo: 55,
    endStatus: 'Batal / Ditolak',
    technician: 'Panendra Soma',
    repairMinutes: 40,
  },
];

export function completedAtOf(entry: ServiceHistory, now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - entry.daysAgo);
  return d;
}
