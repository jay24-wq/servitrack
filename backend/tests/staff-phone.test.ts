import { describe, expect, it } from 'vitest';
import { isValidStaffPhone } from '../../common/utils/staffPhone';

describe('staff phone validation', () => {
  it('accepts international 628 numbers without rewriting them', () => {
    const phone = '6281234567890';
    expect(isValidStaffPhone(phone)).toBe(true);
    expect(phone).toBe('6281234567890');
  });

  it.each(['', '081234567890', '+6281234567890', '628123456789', '62812345678901'])('rejects invalid staff phone %s', (phone) => {
    expect(isValidStaffPhone(phone)).toBe(false);
  });
});
