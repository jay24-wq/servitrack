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
let nominatimQueue: Promise<unknown> = Promise.resolve();
let lastNominatimRequestAt = 0;

function fetchNominatim(url: string) {
  const request = nominatimQueue.then(async () => {
    const wait = Math.max(0, 1000 - (Date.now() - lastNominatimRequestAt));
    if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
    lastNominatimRequestAt = Date.now();
    return fetch(url);
  });
  nominatimQueue = request.then(() => undefined, () => undefined);
  return request;
}

async function reverseGeocode(lat: number, lon: number): Promise<PickupLocation> {
  const params = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lon), zoom: '18', addressdetails: '1', 'accept-language': 'id' });
  const response = await fetchNominatim(`https://nominatim.openstreetmap.org/reverse?${params}`);
  if (!response.ok) throw new Error('Alamat tidak dapat dideteksi.');
  const data = await response.json();
  const address = data.address ?? {};
  const area = address.suburb || address.neighbourhood || address.village || address.town || address.city_district || address.city || address.county || '';
  if (typeof data.display_name !== 'string' || !data.display_name.trim()) throw new Error('Alamat tidak ditemukan pada titik ini. Pilih lokasi lain.');
  return { address: data.display_name, area, latitude: lat, longitude: lon };
}

export default function PickupLocationPicker({ value, onChange, error, searchFirst = false }: { value: PickupLocation | null; onChange: (location: PickupLocation | null) => void; error?: string; searchFirst?: boolean }) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const geocodeRequestRef = useRef(0);
  const placeMarkerRef = useRef<(lat: number, lon: number) => void>(() => {});
  const setPointRef = useRef<(lat: number, lon: number) => void>(() => {});
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');

  function placeMarker(lat: number, lon: number) {
    const map = mapRef.current;
    if (!map) return;
    if (!markerRef.current) {
      const marker = L.marker([lat, lon], { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const point = marker.getLatLng();
        void setPointRef.current(point.lat, point.lng);
      });
      markerRef.current = marker;
      return;
    }
    markerRef.current.setLatLng([lat, lon]);
  }

  async function setPoint(lat: number, lon: number) {
    const requestId = ++geocodeRequestRef.current;
    onChange(null);
    setMessage('Mendeteksi alamat...');
    placeMarkerRef.current(lat, lon);
    const map = mapRef.current;
    if (map) map.setView([lat, lon], Math.max(map.getZoom(), 16));
    try {
      const location = await reverseGeocode(lat, lon);
      if (requestId !== geocodeRequestRef.current) return;
      onChange(location);
      setMessage('Alamat berhasil diperbarui.');
    } catch (err) {
      if (requestId !== geocodeRequestRef.current) return;
      setMessage(err instanceof Error ? err.message : 'Gagal mendeteksi alamat.');
    }
  }

  useEffect(() => {
    placeMarkerRef.current = placeMarker;
    setPointRef.current = setPoint;
  });

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    const map = L.map(mapElement.current).setView(DEFAULT_LOCATION, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
    mapRef.current = map;
    map.on('click', (event) => void setPointRef.current(event.latlng.lat, event.latlng.lng));
    window.setTimeout(() => map.invalidateSize(), 0);
    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  const selectedLatitude = value?.latitude;
  const selectedLongitude = value?.longitude;
  useEffect(() => {
    if (selectedLatitude === undefined || selectedLongitude === undefined) return;
    placeMarkerRef.current(selectedLatitude, selectedLongitude);
    mapRef.current?.setView([selectedLatitude, selectedLongitude], 16);
  }, [selectedLatitude, selectedLongitude]);

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
      const params = new URLSearchParams({ format: 'jsonv2', q: query.trim(), limit: '5', countrycodes: 'id', addressdetails: '1', 'accept-language': 'id' });
      const response = await fetchNominatim(`https://nominatim.openstreetmap.org/search?${params}`);
      if (!response.ok) throw new Error('Pencarian alamat gagal.');
      const results: SearchResult[] = await response.json();
      if (!results.length) throw new Error('Alamat tidak ditemukan.');
      const first = results[0];
      await setPoint(Number(first.lat), Number(first.lon));
      setQuery(first.display_name);
    } catch (err) { setMessage(err instanceof Error ? err.message : 'Pencarian alamat gagal.'); }
    finally { setSearching(false); }
  };

  const searchControls = (
    <div className="flex gap-2">
      <div className="relative flex-1"><MagnifyingGlass className="absolute left-3 top-3.5 text-stone-400" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchAddress(); } }} placeholder="Cari alamat, jalan, atau patokan" className="w-full rounded-lg border border-stone-200 bg-white py-3 pl-10 pr-3 text-sm text-neutral-900 outline-none transition focus:ring-2 focus:ring-sky-500" /></div>
      <button type="button" onClick={() => void searchAddress()} disabled={searching} className="rounded-lg border border-stone-200 bg-white px-4 text-sm font-bold text-neutral-900 transition hover:bg-stone-50 disabled:opacity-60">{searching ? <Spinner className="animate-spin" size={17} /> : 'Cari'}</button>
    </div>
  );
  const locationControls = (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button type="button" onClick={useCurrentLocation} disabled={locating} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-70">
        {locating ? <Spinner className="animate-spin" size={17} /> : <Crosshair size={17} weight="bold" />} Gunakan Lokasi Saat Ini
      </button>
      <button type="button" onClick={() => value && mapRef.current?.setView([value.latitude, value.longitude], 17)} disabled={!value} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-3 text-sm font-bold text-neutral-900 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:text-stone-400">
        <MapPin size={17} weight="fill" /> Recenter
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {searchFirst && searchControls}
      {locationControls}
      {!searchFirst && searchControls}
      <div ref={mapElement} className="h-64 w-full overflow-hidden rounded-xl border border-stone-200" aria-label="Peta lokasi penjemputan" />
      {value && <div className="rounded-xl border border-sky-200 bg-sky-50 p-4"><p className="text-[10px] font-bold uppercase tracking-widest text-sky-700">Alamat Terdeteksi</p><p className="mt-1 text-sm font-semibold leading-relaxed text-neutral-900">{value.address}</p><p className="mt-2 font-mono text-[11px] text-sky-700">{value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}</p></div>}
      {message && <p className="text-[11px] text-stone-500" role="status">{message}</p>}
      {error && <p className="text-[11px] font-medium text-red-600">{error}</p>}
    </div>
  );
}
