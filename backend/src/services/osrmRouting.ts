export type RoutePoint = { latitude: number; longitude: number };
export type CourierRoute = {
  geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
  distance: number;
  duration: number;
};

export class CourierRoutingError extends Error {
  constructor(public readonly status: 429 | 503) {
    super(status === 429 ? 'Permintaan rute terlalu cepat.' : 'Rute jalan belum tersedia.');
  }
}

const DEMO_URL = 'https://router.project-osrm.org';
const DEMO_HOSTS = new Set(['router.project-osrm.org', 'routing.openstreetmap.de']);
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 500;
const REQUEST_INTERVAL_MS = 1000;
const cache = new Map<string, { route: CourierRoute; expiresAt: number }>();
const userRequests = new Map<string, number>();
let lastDemoRequestAt = 0;

export function isPublicOsrmDemo(baseUrl: string) {
  try {
    return DEMO_HOSTS.has(new URL(baseUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function getOsrmBaseUrl(environment = process.env.NODE_ENV, configuredUrl = process.env.OSRM_BASE_URL) {
  if (!configuredUrl?.trim() && environment !== 'development') {
    throw new Error('OSRM_BASE_URL wajib diisi di luar development.');
  }
  const baseUrl = configuredUrl?.trim() || DEMO_URL;
  const parsed = new URL(baseUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('OSRM_BASE_URL harus memakai HTTP atau HTTPS.');
  if (environment === 'production' && isPublicOsrmDemo(baseUrl)) {
    throw new Error('Server demo OSRM tidak boleh digunakan di production.');
  }
  return baseUrl.replace(/\/+$/, '');
}

export function assertOsrmConfiguration() {
  getOsrmBaseUrl();
}

function cacheKey(origin: RoutePoint, destination: RoutePoint) {
  const rounded = (value: number) => value.toFixed(5);
  return `${rounded(origin.longitude)},${rounded(origin.latitude)};${rounded(destination.longitude)},${rounded(destination.latitude)}`;
}

function isValidPoint(point: RoutePoint) {
  return Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90
    && Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180;
}

function trimCache(now: number) {
  for (const [key, entry] of cache) if (entry.expiresAt <= now) cache.delete(key);
  for (const [key, requestedAt] of userRequests) if (requestedAt + 60_000 <= now) userRequests.delete(key);
  while (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
  while (userRequests.size >= 10_000) userRequests.delete(userRequests.keys().next().value!);
}

export async function getCourierRoute(userId: string, origin: RoutePoint, destination: RoutePoint): Promise<CourierRoute> {
  if (!isValidPoint(origin) || !isValidPoint(destination)) throw new CourierRoutingError(503);

  const now = Date.now();
  const key = cacheKey(origin, destination);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.route;

  const baseUrl = getOsrmBaseUrl();
  const isDemo = isPublicOsrmDemo(baseUrl);
  if (now - (userRequests.get(userId) ?? 0) < REQUEST_INTERVAL_MS) throw new CourierRoutingError(429);
  if (isDemo && now - lastDemoRequestAt < REQUEST_INTERVAL_MS) throw new CourierRoutingError(429);
  userRequests.set(userId, now);
  if (isDemo) lastDemoRequestAt = now;
  trimCache(now);

  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = new URL(`${baseUrl}/route/v1/driving/${coordinates}`);
  url.search = new URLSearchParams({ alternatives: 'false', steps: 'false', geometries: 'geojson', overview: 'full' }).toString();

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json', 'User-Agent': 'ServiTrack courier routing' },
    });
    if (!response.ok) throw new Error('OSRM request failed');
    const result = await response.json() as {
      code?: string;
      routes?: Array<{ geometry?: { type?: string; coordinates?: unknown }; distance?: unknown; duration?: unknown }>;
    };
    const route = result.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    const distance = Number(route?.distance);
    const duration = Number(route?.duration);
    if (result.code !== 'Ok' || route?.geometry?.type !== 'LineString' || !Array.isArray(coordinates) || coordinates.length < 2
      || !Number.isFinite(distance) || distance < 0 || !Number.isFinite(duration) || duration < 0
      || !coordinates.every((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2
        && Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1])
        && Number(coordinate[0]) >= -180 && Number(coordinate[0]) <= 180
        && Number(coordinate[1]) >= -90 && Number(coordinate[1]) <= 90)) {
      throw new Error('Invalid OSRM route');
    }
    const value: CourierRoute = {
      geometry: { type: 'LineString', coordinates: coordinates as Array<[number, number]> },
      distance,
      duration,
    };
    trimCache(Date.now());
    cache.set(key, { route: value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  } catch {
    throw new CourierRoutingError(503);
  }
}
