import { describe, expect, it } from 'vitest';
import { decryptSecretField, encryptSecretField } from '../src/utils/secretField';

describe('sensitive field encryption', () => {
  it('encrypts and restores a device PIN without storing plaintext', () => {
    const pin = 'device-pin-1234';
    const encrypted = encryptSecretField(pin);

    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toContain(pin);
    expect(decryptSecretField(encrypted)).toBe(pin);
  });

  it('handles empty and invalid ciphertext safely', () => {
    expect(encryptSecretField('')).toBeNull();
    expect(decryptSecretField(null)).toBeNull();
    expect(decryptSecretField('not-encrypted')).toBeNull();
  });
});
