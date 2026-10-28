import { haversineKm, hitungOngkir, STORE_LOCATION } from './ongkir';
import BALI_REGIONS from '../data/bali-regions.json';

type VillagePoint = { lat: number; lng: number };

function normalizeKey(...values: string[]): string {
  return values.map((value) => value.trim().toLowerCase()).join('|');
}

const villageIndex = new Map<string, VillagePoint>();
const postalIndex = new Map<string, VillagePoint>();

for (const city of BALI_REGIONS) {
  for (const district of city.districts) {
    for (const village of district.villages) {
      const point = { lat: village.lat, lng: village.lng };
      villageIndex.set(normalizeKey(city.name, district.name, village.name), point);
      if (village.postal && !postalIndex.has(village.postal)) {
        postalIndex.set(village.postal, point);
      }
    }
  }
}

/** Legacy snapshot for bookings that only have pickup_area. New bookings use OSRM below. */
export function computePickupFeeSnapshot(serviceMethod: string, pickupArea?: string | null): number {
  if (serviceMethod !== 'pickup_only' && serviceMethod !== 'pickup_delivery') return 0;
  if (!pickupArea) return 0;

  const parts = pickupArea.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return 0;

  const postal = parts[parts.length - 1].replace(/\D/g, '');
  const exactVillage =
    parts.length >= 4 ? villageIndex.get(normalizeKey(parts[1], parts[2], parts[3])) : undefined;
  const village = exactVillage ?? (postal ? postalIndex.get(postal) : undefined);
  if (!village) return 0;

  const distanceKm = haversineKm(STORE_LOCATION.lat, STORE_LOCATION.lng, village.lat, village.lng);
  return hitungOngkir(distanceKm);
}

export async function computePickupFeeFromCoordinates(serviceMethod: string, latitude: number, longitude: number): Promise<number> {
  if (serviceMethod !== 'pickup_only' && serviceMethod !== 'pickup_delivery') return 0;
  const fallback = () => {
    console.warn('[OSRM] Routing server gagal, snapshot ongkir memakai fallback Haversine.');
    return hitungOngkir(haversineKm(STORE_LOCATION.lat, STORE_LOCATION.lng, latitude, longitude));
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const coordinates = `${STORE_LOCATION.lng},${STORE_LOCATION.lat};${longitude},${latitude}`;
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false`, { signal: controller.signal });
    if (!response.ok) return fallback();
    const data = await response.json() as { code?: string; routes?: Array<{ distance: number }> };
    const distanceKm = data.code === 'Ok' && data.routes?.[0] ? data.routes[0].distance / 1000 : null;
    return distanceKm === null ? fallback() : hitungOngkir(distanceKm);
  } catch (error) {
    console.warn('[OSRM] Routing server tidak tersedia, snapshot ongkir memakai fallback Haversine.', error);
    return fallback();
  } finally {
    clearTimeout(timeout);
  }
}
