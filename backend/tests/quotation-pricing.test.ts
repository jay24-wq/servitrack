import { describe, expect, it } from 'vitest';
import { priceQuotationLine } from '../src/services/quotationPricing';

describe('quotation line pricing', () => {
  it('calculates snapshot totals and availability without mutating stock', () => {
    const line = priceQuotationLine({ qty: 2, laborCost: 150_000, partUnitPrice: 200_000, availableQty: 1, estimatedPartArrivalDays: 7 });
    expect(line).toEqual({
      partCost: 400_000,
      subtotal: 550_000,
      availabilityStatus: 'TERSEDIA_SEBAGIAN',
      availableQtySnapshot: 1,
      estimatedPartArrivalDays: 7,
    });
  });

  it('supports jasa-only quotation lines and omits stock snapshots', () => {
    expect(priceQuotationLine({ qty: 1, laborCost: 50_000, estimatedPartArrivalDays: 7 })).toMatchObject({
      partCost: 0,
      subtotal: 50_000,
      availabilityStatus: null,
      availableQtySnapshot: null,
      estimatedPartArrivalDays: null,
    });
  });

  it('marks part custom as unavailable and snapshots its estimated price and arrival', () => {
    expect(priceQuotationLine({ qty: 2, laborCost: 0, partUnitPrice: 125_000, availableQty: 0, estimatedPartArrivalDays: 9 })).toEqual({
      partCost: 250_000,
      subtotal: 250_000,
      availabilityStatus: 'TIDAK_TERSEDIA',
      availableQtySnapshot: 0,
      estimatedPartArrivalDays: 9,
    });
  });
});
