import type { CourierPlace } from '../../../common/utils/courierDestination';

export { resolveCourierDestination } from '../../../common/utils/courierDestination';
export type { CourierPlace } from '../../../common/utils/courierDestination';

export function googleMapsDirectionsUrl(destination: CourierPlace) {
  const target = destination.latitude !== null && destination.longitude !== null
    ? `${destination.latitude},${destination.longitude}`
    : destination.address;
  return target ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}` : null;
}

export function localPhoneNumber(value?: string | null) {
  let digits = value?.replace(/\D/g, '') ?? '';
  if (digits.startsWith('0062')) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith('62')) digits = `0${digits.slice(2)}`;
  else if (digits.startsWith('8')) digits = `0${digits}`;
  return digits || null;
}

export function courierFailureFormReady(reason: string, notes: string, busy = false) {
  return !busy && Boolean(reason) && (reason !== 'OTHER' || Boolean(notes.trim()));
}
