export interface Part {
  id: string;
  name: string;
  spec: string;
  stock: number;
  min: number;
  unit: string;
  price: number;
  bin: string;
}

export const PARTS: Part[] = [
  { id: 'PRT-001', name: 'LCD iPhone 13 Pro', spec: 'Super Retina XDR OLED', stock: 9, min: 5, unit: 'pcs', price: 1500000, bin: 'Rak A-02' },
  { id: 'PRT-002', name: 'Baterai MacBook Air M2', spec: 'A2681 Li-Polymer', stock: 4, min: 5, unit: 'pcs', price: 800000, bin: 'Rak B-01' },
  { id: 'PRT-003', name: 'Baterai Lenovo ThinkPad X1', spec: '57Wh 3-Cell Internal', stock: 23, min: 5, unit: 'pcs', price: 300000, bin: 'Rak B-04' },
  { id: 'PRT-006', name: 'LCD Poco X3 Pro Fullset', spec: 'IPS LCD 120Hz HDR10', stock: 7, min: 5, unit: 'pcs', price: 150000, bin: 'Rak A-07' },
  { id: 'PRT-012', name: 'IC Power Asus ROG PM8150', spec: 'Qualcomm PMIC Chipset', stock: 11, min: 5, unit: 'pcs', price: 350000, bin: 'Drawer C-03' },
  { id: 'PRT-020', name: 'Thermal Paste Arctic MX-4 4g', spec: 'Carbon micro-particles', stock: 14, min: 3, unit: 'tube', price: 125000, bin: 'Rak D-01' },
  { id: 'PRT-004', name: 'Keyboard MacBook Pro M1', spec: 'Backlit US Layout Genuine', stock: 6, min: 4, unit: 'pcs', price: 1850000, bin: 'Rak C-02' },
  { id: 'PRT-031', name: 'Flex Display iPhone 13', spec: 'OEM Ribbon Cable tested', stock: 8, min: 6, unit: 'pcs', price: 210000, bin: 'Rak A-05' },
  { id: 'PRT-040', name: 'Keyboard Module ASUS ZenBook 14', spec: 'Backlit Replacement Module', stock: 0, min: 3, unit: 'pcs', price: 640000, bin: 'Rak C-05' },
  { id: 'PRT-033', name: 'Fan Cooling Module ThinkPad X1', spec: 'Dual Heatpipe Fan Assembly', stock: 2, min: 4, unit: 'pcs', price: 275000, bin: 'Rak E-02' },
];

export type StockLevel = 'Habis' | 'Menipis' | 'Aman';

export function stockLevel(part: Part): StockLevel {
  if (part.stock <= 0) return 'Habis';
  if (part.stock < part.min) return 'Menipis';
  return 'Aman';
}

export function angka(value: number) {
  return new Intl.NumberFormat('id-ID').format(value);
}
