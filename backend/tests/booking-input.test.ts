import { describe, expect, it } from 'vitest';
import pg from 'pg';
import '../src/models/index';
import { normalizePickupArea, normalizePickupTime } from '../src/utils/booking';
import { computePickupFeeSnapshot } from '../src/utils/pickup-fee';

describe('booking input normalization', () => {
  it('serializes PostgreSQL DATE as YYYY-MM-DD without timezone shift', () => {
    expect(pg.types.getTypeParser(1082)('2026-10-18')).toBe('2026-10-18');
  });

  it('trims pickup values and converts blanks to null', () => {
    expect(normalizePickupTime(' 14:00 ')).toBe('14:00');
    expect(normalizePickupArea('  Bali, Denpasar  ')).toBe('Bali, Denpasar');
    expect(normalizePickupArea('   ')).toBeNull();
  });

  it('rejects object payloads and legacy object coercion', () => {
    expect(() => normalizePickupArea({ city: 'Denpasar' })).toThrow('pickup_area harus berupa teks');
    expect(() => normalizePickupArea('[object Object], Bali, Denpasar')).toThrow('pickup_area tidak valid');
  });

  it('computes pickup fee from the same area string used by the booking form', () => {
    const area = 'Bali, Kota Denpasar, Denpasar Timur, Penatih, 80238';
    expect(computePickupFeeSnapshot('pickup_only', area)).toBe(20000);
    expect(computePickupFeeSnapshot('pickup_delivery', area)).toBe(20000);
    expect(computePickupFeeSnapshot('dropoff', area)).toBe(0);
    expect(computePickupFeeSnapshot('pickup_only', null)).toBe(0);
  });
});
