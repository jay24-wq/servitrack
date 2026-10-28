import { useEffect, useRef, useState } from 'react';
import { Crosshair, MagnifyingGlass, MapPin, Spinner } from '@phosphor-icons/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type PickupLocation = {
  address: string;
  area: string;
  latitude: number;
  longitude: number;
};

type SearchResult = { display_name: string; lat: string; lon: string };

const DEFAULT_LOCATION: [number, number] = [-8.6705, 115.2126];

async function reverseGeocode(lat: number, lon: number): Promise<PickupLocation> {
  const params = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lon), zoom: '18', addressdetails: '1' });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
  if (!response.ok) throw new Error('Alamat tidak dapat dideteksi.');
  const data = await response.json();
  const address = data.address ?? {};
  const area = address.suburb || address.neighbourhood || address.village || address.town || address.city_district || address.city || address.county || '';
  return { address: data.display_name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`, area, latitude: lat, longitude: lon };
}

export default function PickupLocationPicker({ value, onChange, error }: { value: PickupLocation | null; onChange: (location: PickupLocation) => void; error?: string }) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');

  const setPoint = async (lat: number, lon: number) => {
    setMessage('Mendeteksi alamat...');
    try {
      const location = await reverseGeocode(lat, lon);
      onChange(location);
      mapRef.current?.setView([lat, lon], Math.max(mapRef.current.getZoom(), 16));
      markerRef.current?.setLatLng([lat, lon]);
      setMessage('Alamat berhasil diperbarui.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Gagal mendeteksi alamat.');
    }
  };

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    const map = L.map(mapElement.current).setView(value ? [value.latitude, value.longitude] : DEFAULT_LOCATION, value ? 16 : 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
    const marker = L.marker(value ? [value.latitude, value.longitude] : DEFAULT_LOCATION, { draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const point = marker.getLatLng();
      void setPoint(point.lat, point.lng);
    });
    map.on('click', (event) => void setPoint(event.latlng.lat, event.latlng.lng));
    mapRef.current = map;
    markerRef.current = marker;
    window.setTimeout(() => map.invalidateSize(), 0);
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { setMessage('Browser ini tidak mendukung lokasi otomatis.'); return; }
    setLocating(true);
    setMessage('Meminta izin lokasi...');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setLocating(false); void setPoint(coords.latitude, coords.longitude); },
      () => { setLocating(false); setMessage('Akses lokasi ditolak. Cari alamat secara manual atau pilih titik di peta.'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const searchAddress = async () => {
    if (query.trim().length < 3) return;
    setSearching(true); setMessage('Mencari alamat...');
    try {
      const params = new URLSearchParams({ format: 'jsonv2', q: query.trim(), limit: '5', countrycodes: 'id', addressdetails: '1' });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      if (!response.ok) throw new Error('Pencarian alamat gagal.');
      const results: SearchResult[] = await response.json();
      if (!results.length) throw new Error('Alamat tidak ditemukan.');
      const first = results[0];
      await setPoint(Number(first.lat), Number(first.lon));
      setQuery(first.display_name);
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Pencarian alamat gagal.'); }
    finally { setSearching(false); }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={useCurrentLocation} disabled={locating} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-70">
          {locating ? <Spinner className="animate-spin" size={17} /> : <Crosshair size={17} weight="bold" />} Gunakan Lokasi Saat Ini
        </button>
        <button type="button" onClick={() => value && mapRef.current?.setView([value.latitude, value.longitude], 17)} disabled={!value} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-neutral-900 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400">
          <MapPin size={17} weight="fill" /> Recenter
        </button>
      </div>
      <div className="flex gap-2">
        <div className="relative flex-1"><MagnifyingGlass className="absolute left-3 top-3.5 text-stone-400" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchAddress(); } }} placeholder="Cari alamat, jalan, atau patokan" className="w-full rounded-lg border border-stone-200 bg-white py-3 pl-10 pr-3 text-sm text-neutral-900 outline-none transition focus:ring-2 focus:ring-sky-500" /></div>
        <button type="button" onClick={() => void searchAddress()} disabled={searching} className="rounded-lg border border-stone-200 bg-white px-4 text-sm font-bold text-neutral-900 transition hover:bg-stone-50 disabled:opacity-60">{searching ? <Spinner className="animate-spin" size={17} /> : 'Cari'}</button>
      </div>
      <div ref={mapElement} className="h-64 w-full overflow-hidden rounded-xl border border-stone-200" aria-label="Peta lokasi penjemputan" />
      {value && <div className="rounded-xl border border-sky-200 bg-sky-50 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-sky-700">Alamat Terdeteksi</p><p className="mt-1 text-sm font-semibold leading-relaxed text-neutral-900">{value.address}</p><p className="mt-2 font-mono text-[11px] text-sky-700">{value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</p></div>}
      {message && <p className="text-[11px] text-stone-500" role="status">{message}</p>}
      {error && <p className="text-[11px] font-medium text-red-600">{error}</p>}
    </div>
  );
}
