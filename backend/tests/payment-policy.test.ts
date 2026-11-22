import { describe, expect, it } from 'vitest';
import { validateOfflinePayment } from '../src/services/payments/paymentPolicy';

describe('full offline payment policy', () => {
  it('accepts only the invoice total and calculates cash change from received cash', () => {
    expect(validateOfflinePayment({ method: 'cash', amount: 354000, total: 354000, cashReceived: 400000 })).toEqual({ changeAmount: 46000 });
    expect(() => validateOfflinePayment({ method: 'cash', amount: 300000, total: 354000, cashReceived: 354000 })).toThrow('Nominal harus sama dengan total invoice');
  });

  it('requires references for transfer, e-wallet, and EDC', () => {
    for (const method of ['bank_transfer', 'ewallet', 'edc']) {
      expect(() => validateOfflinePayment({ method, amount: 354000, total: 354000 })).toThrow('Nomor referensi wajib diisi');
      expect(validateOfflinePayment({ method, amount: 354000, total: 354000, reference: 'REF-123' })).toEqual({ changeAmount: 0 });
    }
  });

  it('rejects underpaid cash and non-cash methods that do not belong to the offline cashier', () => {
    expect(() => validateOfflinePayment({ method: 'cash', amount: 354000, total: 354000, cashReceived: 353000 })).toThrow('Uang diterima harus minimal');
    expect(() => validateOfflinePayment({ method: 'partial', amount: 354000, total: 354000 })).toThrow('Metode pembayaran offline tidak valid');
  });
});
