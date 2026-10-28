export interface CreatePartDto {
  branch_id?: string;
  sku: string;
  name: string;
  category?: string;
  spec?: string | null;
  unit?: string;
  stock_qty?: number;
  min_stock?: number;
  cost_price?: number;
  sell_price?: number;
  bin_location?: string | null;
}

export interface StockInDto {
  part_id: string;
  qty: number;
  cost_price?: number;
  note?: string | null;
}
