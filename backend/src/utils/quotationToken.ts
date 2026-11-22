import { createHash, randomBytes } from 'node:crypto';

export function createQuotationToken() {
  return randomBytes(32).toString('hex');
}

export function hashQuotationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
