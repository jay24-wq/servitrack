import { afterEach, describe, expect, it, vi } from 'vitest';
import { CourierRoutingError, getCourierRoute, getOsrmBaseUrl, isPublicOsrmDemo } from '../src/services/osrmRouting';

const routeResponse = {
  code: 'Ok',
  routes: [{
    geometry: { type: 'LineString', coordinates: [[115.21, -8.65], [115.22, -8.66]] },
    distance: 2345,
    duration: 480,
  }],
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OSRM_BASE_URL;
});

describe('OSRM courier routing', () => {
  it('requests driving GeoJSON with longitude,latitude order and caches the route', async () => {
    process.env.OSRM_BASE_URL = 'http://localhost:5000';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => routeResponse });
    vi.stubGlobal('fetch', fetchMock);
    const origin = { latitude: -8.65, longitude: 115.21 };
    const destination = { latitude: -8.66, longitude: 115.22 };

    const first = await getCourierRoute('route-test-cache', origin, destination);
    const second = await getCourierRoute('route-test-cache', origin, destination);

    expect(first).toEqual({ geometry: routeResponse.routes[0].geometry, distance: 2345, duration: 480 });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestedUrl.pathname).toBe('/route/v1/driving/115.21,-8.65;115.22,-8.66');
    expect(requestedUrl.searchParams.get('geometries')).toBe('geojson');
    expect(requestedUrl.searchParams.get('overview')).toBe('full');
  });

  it('limits distinct upstream requests per user', async () => {
    process.env.OSRM_BASE_URL = 'http://localhost:5000';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => routeResponse }));
    await getCourierRoute('route-test-limit', { latitude: -8.7, longitude: 115.2 }, { latitude: -8.71, longitude: 115.21 });

    await expect(getCourierRoute('route-test-limit', { latitude: -8.72, longitude: 115.22 }, { latitude: -8.73, longitude: 115.23 }))
      .rejects.toMatchObject({ status: 429 });
  });

  it('fails safely for invalid upstream responses and production demo configuration', async () => {
    process.env.OSRM_BASE_URL = 'http://localhost:5000';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    await expect(getCourierRoute('route-test-error', { latitude: -8.8, longitude: 115.3 }, { latitude: -8.81, longitude: 115.31 }))
      .rejects.toBeInstanceOf(CourierRoutingError);

    expect(isPublicOsrmDemo('https://router.project-osrm.org')).toBe(true);
    expect(isPublicOsrmDemo('https://routing.openstreetmap.de/routed-car')).toBe(true);
    expect(() => getOsrmBaseUrl('production', '')).toThrow();
    expect(() => getOsrmBaseUrl('production', 'https://router.project-osrm.org')).toThrow();
    expect(() => getOsrmBaseUrl('production', 'https://routing.openstreetmap.de/routed-car')).toThrow();
    expect(getOsrmBaseUrl('development', '')).toBe('https://router.project-osrm.org');
  });

  it('turns upstream timeouts into a safe routing error', async () => {
    process.env.OSRM_BASE_URL = 'http://localhost:5000';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream timeout')));

    await expect(getCourierRoute('route-test-timeout', { latitude: -8.82, longitude: 115.32 }, { latitude: -8.83, longitude: 115.33 }))
      .rejects.toMatchObject({ status: 503, message: 'Rute jalan belum tersedia.' });
  });
});
