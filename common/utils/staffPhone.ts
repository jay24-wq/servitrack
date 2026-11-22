export const STAFF_PHONE_PATTERN = /^628\d{10}$/;

export function isValidStaffPhone(value: unknown): value is string {
  return typeof value === 'string' && STAFF_PHONE_PATTERN.test(value);
}
