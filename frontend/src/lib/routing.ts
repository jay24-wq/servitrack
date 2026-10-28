import { haversineKm, STORE_LOCATION } from './ongkir';

export type DrivingRoute = {
  distanceKm: number;
  durationMinutes: number | null;
  source: 'osrm' | 'haversine';
};

type OsrmResponse = { code: string; routes?: Array<{ distance: number; duration: number }> };

export async function getDrivingRoute(latitude: number, longitude: number): Promise<DrivingRoute> {
  const fallback = (): DrivingRoute => {
    console.warn('[OSRM] Routing tidak tersedia, menggunakan fallback Haversine.');
    return {
      distanceKm: haversineKm(STORE_LOCATION.lat, STORE_LOCATION.lng, latitude, longitude),
      durationMinutes: null,
      source: 'haversine',
    };
  };
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const coordinates = `${STORE_LOCATION.lng},${STORE_LOCATION.lat};${longitude},${latitude}`;
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=false`, { signal: controller.signal });
    if (!response.ok) return fallback();
    const data: OsrmResponse = await response.json();
    const route = data.code === 'Ok' ? data.routes?.[0] : undefined;
    if (!route) return fallback();
    return { distanceKm: route.distance / 1000, durationMinutes: Math.max(1, Math.round(route.duration / 60)), source: 'osrm' };
  } catch (error) {
    console.warn('[OSRM] Gagal mengambil rute, menggunakan fallback Haversine.', error);
    return fallback();
  } finally {
    window.clearTimeout(timeout);
  }
}
