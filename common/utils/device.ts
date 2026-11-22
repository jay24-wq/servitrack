export const UNKNOWN_DEVICE_NAME = 'Perangkat tidak diketahui';

export function getDeviceDisplayName(model?: string | null): string {
  return model == null || model.trim() === '' || model.trim() === '-'
    ? UNKNOWN_DEVICE_NAME
    : model;
}
