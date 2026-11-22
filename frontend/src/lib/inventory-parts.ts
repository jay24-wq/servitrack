import type { InventoryPartRow } from './api';

export interface InventoryPart {
  id: string;
  sku: string;
  name: string;
  spec: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  price: number;
  cost: number;
  bin: string;
}

export type InventoryStockStatus = 'Habis' | 'Menipis' | 'Aman';

export function mapInventoryPart(row: InventoryPartRow): InventoryPart {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    spec: row.spec ?? '',
    category: row.category || 'Umum',
    stock: Number(row.stock_qty ?? 0),
    minStock: Number(row.min_stock ?? 0),
    unit: row.unit || 'pcs',
    price: Number(row.sell_price ?? 0),
    cost: Number(row.cost_price ?? 0),
    bin: row.bin_location || '-',
  };
}

export function inventoryStockStatus(stock: number, minStock: number): InventoryStockStatus {
  if (stock <= 0) return 'Habis';
  if (stock <= minStock) return 'Menipis';
  return 'Aman';
}

export function formatInventoryNumber(value: number) {
  return new Intl.NumberFormat('id-ID').format(value);
}

export function parseInventoryNumber(value: string) {
  return value.replace(/\D/g, '');
}

export function toIntegerPrice(value: number | string | null | undefined) {
  const price = Number(value);
  return Number.isFinite(price) ? Math.round(price) : 0;
}
