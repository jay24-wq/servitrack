import { describe, expect, it } from 'vitest';
import { createQuotationToken, hashQuotationToken } from '../src/utils/quotationToken';

describe('quotation approval tokens', () => {
  it('creates unguessable-shaped single-use tokens and stores only a stable digest', () => {
    const first = createQuotationToken();
    const second = createQuotationToken();
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
    expect(hashQuotationToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashQuotationToken(first)).toBe(hashQuotationToken(first));
    expect(hashQuotationToken(first)).not.toBe(first);
  });
});
