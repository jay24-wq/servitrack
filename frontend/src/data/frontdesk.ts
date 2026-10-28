export interface BookingSlot {
  id: string;
  time: string;
  code: string;
  customer: string;
  phone: string; // digits, untuk wa.me
  phoneDisplay: string;
  device: string;
  method: 'Dropoff' | 'Pickup' | 'Pickup-Delivery';
  status: 'Menunggu' | 'Checked-in' | 'No-Show' | 'Batal';
}

export interface InvoicePart {
  name: string;
  qty: number;
  price: number;
}

export interface Invoice {
  ticketId: string;
  customer: string;
  phone: string;
  phoneDisplay: string;
  device: string;
  serviceFee: number;
  parts: InvoicePart[];
  discount: number;
  status: 'Belum Lunas' | 'Lunas';
  readyAt: string;
}

export interface ActiveTicket {
  ticketId: string;
  customer: string;
  phone: string;
  phoneDisplay: string;
  device: string;
  status:
    | 'Antrian'
    | 'Pengecekan'
    | 'Pengerjaan'
    | 'Siap Diambil'
    | 'Menunggu Check-in'
    | 'Checked-in'
    | 'Batal';
  updated: string;
}

export type CourierStatus = 'Pending' | 'In Transit' | 'Delivered';

export interface PickupRequest {
  id: string;
  customer: string;
  phone: string;
  phoneDisplay: string;
  address: string;
  type: 'Pickup' | 'Delivery';
  device: string;
  schedule: string;
  status: CourierStatus;
  courier?: string;
}

export const INVOICES: Invoice[] = [
  {
    ticketId: 'SRV4829103756',
    customer: 'Angga Santos',
    phone: '6281298440011',
    phoneDisplay: '+62 812-9844-0011',
    device: 'ASUS ROG Zephyrus G14',
    serviceFee: 350000,
    parts: [{ name: 'IC Power Asus ROG PM8150', qty: 1, price: 350000 }],
    discount: 50000,
    status: 'Belum Lunas',
    readyAt: 'Hari ini, 11:20 WIB',
  },
  {
    ticketId: 'SRV7312049865',
    customer: 'Lestari Dewanti',
    phone: '6282144510022',
    phoneDisplay: '+62 821-4451-0022',
    device: 'MacBook Air M2 13"',
    serviceFee: 400000,
    parts: [{ name: 'Baterai MacBook Air M2', qty: 1, price: 800000 }],
    discount: 0,
    status: 'Belum Lunas',
    readyAt: 'Hari ini, 13:05 WIB',
  },
  {
    ticketId: 'SRV6550183927',
    customer: 'Clara Melisa',
    phone: '6285611920066',
    phoneDisplay: '+62 856-1192-0066',
    device: 'Dell XPS 15 9520 OLED',
    serviceFee: 250000,
    parts: [],
    discount: 25000,
    status: 'Belum Lunas',
    readyAt: 'Kemarin, 17:40 WIB',
  },
  {
    ticketId: 'SRV8173620945',
    customer: 'Rizal Fadillah',
    phone: '6281944200077',
    phoneDisplay: '+62 819-4420-0077',
    device: 'Lenovo IdeaPad Slim 5',
    serviceFee: 200000,
    parts: [{ name: 'SSD NVMe 1TB', qty: 1, price: 950000 }],
    discount: 0,
    status: 'Lunas',
    readyAt: 'Kemarin, 15:10 WIB',
  },
];

export const PICKUP_REQUESTS: PickupRequest[] = [
  { id: 'PKP-2201', customer: 'Maya Kusuma', phone: '6285644100044', phoneDisplay: '+62 856-4410-0044', address: 'Jl. Melati Raya No. 18, Denpasar Selatan', type: 'Pickup', device: 'Galaxy S24 Ultra', schedule: 'Hari ini, 14:00 WIB', status: 'Pending' },
  { id: 'PKP-2202', customer: 'Rafi Mahendra', phone: '6281298440011', phoneDisplay: '+62 812-9844-0011', address: 'Jl. Kuta Raya No. 5, Badung', type: 'Pickup', device: 'ASUS ROG Strix G15', schedule: 'Hari ini, 10:00 WIB', status: 'In Transit', courier: 'Dwi Santosa' },
  { id: 'PKP-2203', customer: 'Dewi Anggraini', phone: '6281266100099', phoneDisplay: '+62 812-6610-0099', address: 'Jl. Renon No. 21, Denpasar Timur', type: 'Delivery', device: 'iPhone 14 Pro', schedule: 'Hari ini, 16:30 WIB', status: 'Pending' },
  { id: 'PKP-2204', customer: 'Clara Melisa', phone: '6285611920066', phoneDisplay: '+62 856-1192-0066', address: 'Jl. Ubung No. 8, Denpasar Utara', type: 'Pickup', device: 'Dell XPS 15 9520', schedule: 'Kemarin, 15:00 WIB', status: 'Delivered', courier: 'Agus Pramana' },
  { id: 'PKP-2205', customer: 'Hendra Gunawan', phone: '6287833010055', phoneDisplay: '+62 878-3301-0055', address: 'Jl. Sesetan No. 44, Denpasar Selatan', type: 'Delivery', device: 'HP Spectre x360 14', schedule: 'Hari ini, 17:00 WIB', status: 'In Transit', courier: 'Dwi Santosa' },
];

export const COURIERS = ['Dwi Santosa', 'Agus Pramana', 'Komang Adi', 'Bayu Setiawan'];

export function rupiah(value: number) {
  return new Intl.NumberFormat('id-ID').format(value);
}

export function waLink(phone: string, message: string) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
