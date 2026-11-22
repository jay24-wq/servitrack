const OFFLINE_METHODS = new Set(['cash', 'bank_transfer', 'qris_static', 'ewallet', 'edc']);
const REFERENCE_METHODS = new Set(['bank_transfer', 'ewallet', 'edc']);

export function validateOfflinePayment(input: {
  method: string;
  amount: number;
  total: number;
  reference?: string | null;
  cashReceived?: number;
}) {
  if (!OFFLINE_METHODS.has(input.method)) throw new Error('Metode pembayaran offline tidak valid');
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount !== input.total) {
    throw new Error('Nominal harus sama dengan total invoice');
  }
  if (REFERENCE_METHODS.has(input.method) && !String(input.reference ?? '').trim()) {
    throw new Error('Nomor referensi wajib diisi untuk metode ini');
  }
  if (input.method === 'cash' && (!Number.isSafeInteger(input.cashReceived) || Number(input.cashReceived) < input.total)) {
    throw new Error('Uang diterima harus minimal sama dengan total invoice');
  }
  return { changeAmount: input.method === 'cash' ? Number(input.cashReceived) - input.total : 0 };
}
