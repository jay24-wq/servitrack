import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { appConfig } from '@config/app';

const key = createHash('sha256')
  .update('servitrack:secret-fields:v1\0')
  .update(process.env.PII_ENCRYPTION_KEY || appConfig.jwtSecret)
  .digest();

export function encryptSecretField(value?: string | null) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecretField(value?: string | null) {
  if (!value?.startsWith('v1.')) return null;
  try {
    const [, iv, authTag, encrypted] = value.split('.');
    if (!iv || !authTag || !encrypted) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
