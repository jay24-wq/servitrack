import { describe, expect, it } from 'vitest';
import { generateTrackingCode } from '../src/utils/code';

describe('generateTrackingCode', () => {
  it('uses the tenant prefix and appends ten random digits', () => {
    expect(generateTrackingCode('mem')).toMatch(/^MEM\d{10}$/);
  });

  it.each(['AB', 'ABCD', 'SRV-'])('rejects invalid prefixes: %s', (prefix) => {
    expect(() => generateTrackingCode(prefix)).toThrow('Prefix tracking harus terdiri dari 3 huruf A-Z');
  });
});
