function textOrNull(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw Object.assign(new Error(`${field} harus berupa teks`), { status: 400 });
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > maxLength) {
    throw Object.assign(new Error(`${field} maksimal ${maxLength} karakter`), { status: 400 });
  }
  return normalized;
}

export function normalizePickupTime(value: unknown): string | null {
  return textOrNull(value, 'pickup_time', 20);
}

export function normalizePickupArea(value: unknown): string | null {
  const area = textOrNull(value, 'pickup_area', 255);
  if (area && /\[object Object\]/i.test(area)) {
    throw Object.assign(new Error('pickup_area tidak valid'), { status: 400 });
  }
  return area;
}

export function normalizePickupCoordinate(value: unknown, field: string, min: number, max: number): number | null {
  if (value === undefined || value === null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw Object.assign(new Error(`${field} tidak valid`), { status: 400 });
  }
  return number;
}
