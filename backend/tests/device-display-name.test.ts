import { describe, expect, it } from 'vitest';
import { getDeviceDisplayName, UNKNOWN_DEVICE_NAME } from '../../common/utils/device';

describe('getDeviceDisplayName', () => {
  it('returns the complete model unchanged', () => {
    expect(getDeviceDisplayName('Asus ROG Strix 16 2025')).toBe('Asus ROG Strix 16 2025');
    expect(getDeviceDisplayName('Samsung')).toBe('Samsung');
    expect(getDeviceDisplayName('  iPhone 13  ')).toBe('  iPhone 13  ');
  });

  it('uses the unknown-device label for empty and dash values', () => {
    for (const model of [null, undefined, '', '   ', '-', ' - ']) {
      expect(getDeviceDisplayName(model)).toBe(UNKNOWN_DEVICE_NAME);
    }
  });
});
