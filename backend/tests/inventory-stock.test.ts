import { describe, expect, it } from 'vitest';
import { formatInventoryNumber, inventoryStockStatus, mapInventoryPart, parseInventoryNumber, toIntegerPrice } from '../../frontend/src/lib/inventory-parts';

describe('Kanban inventory status', () => {
  it('derives stock state from live stock and minimum quantities', () => {
    expect(inventoryStockStatus(10, 3)).toBe('Aman');
    expect(inventoryStockStatus(2, 3)).toBe('Menipis');
    expect(inventoryStockStatus(0, 3)).toBe('Habis');
  });

  it('maps the database inventory row without fixture data', () => {
    const part = mapInventoryPart({
      id: 'part-1',
      tenant_id: 'tenant-1',
      branch_id: 'branch-1',
      sku: 'LCD-013',
      name: 'LCD iPhone',
      spec: 'OLED',
      category: 'LCD',
      stock_qty: '2',
      min_stock: 3,
      unit: 'pcs',
      sell_price: '1500000',
      cost_price: '1000000',
      bin_location: 'A-02',
      is_active: true,
    });

    expect(part).toMatchObject({ id: 'part-1', sku: 'LCD-013', name: 'LCD iPhone', stock: 2, minStock: 3 });
    expect(inventoryStockStatus(part.stock, part.minStock)).toBe('Menipis');
  });
});

describe('inventory rupiah input values', () => {
  it('formats integer prices with Indonesian thousand separators and keeps digits as the value', () => {
    expect(formatInventoryNumber(275000)).toBe('275.000');
    expect(parseInventoryNumber('Rp 275.000')).toBe('275000');
  });

  it('converts decimal request prices to whole rupiah before prefilling', () => {
    expect(toIntegerPrice('275000.00')).toBe(275000);
  });
});
