const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;
const TIME_PREFIX = /^(\d{1,2}):(\d{2})/;
const PICKUP_METHODS = new Set(['pickup_only', 'pickup_delivery', 'terjadwal', 'antar_jemput']);

export function formatBookingDate(value?: string | null): string {
  if (!value) return '—';
  const match = DATE_PREFIX.exec(value.trim());
  if (!match) return value;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatPickupTime(value?: string | null): string {
  if (!value) return '';
  const text = value.trim();
  const match = TIME_PREFIX.exec(text);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;

  if (text.includes('T')) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Makassar',
      });
    }
  }

  return text;
}

export function formatBookingSchedule(
  slotDate?: string | null,
  pickupTime?: string | null,
  serviceMethod?: string | null
): string {
  const date = formatBookingDate(slotDate);
  if (!PICKUP_METHODS.has(serviceMethod ?? '')) return date;

  const time = formatPickupTime(pickupTime);
  return time ? `${date} ${time} WITA` : date;
}
