import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { CourierRoute } from '../../lib/api';

export type MapPoint = { name: string; label: string; latitude: number; longitude: number };

export default function CourierTaskMap({ pickup, destination, courier, route }: { pickup: MapPoint; destination: MapPoint; courier?: MapPoint | null; route: CourierRoute | null }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!element.current || map.current) return;
    const instance = L.map(element.current, { zoomControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Routing by <a href="https://project-osrm.org/">OSRM</a>',
      maxZoom: 19,
    }).addTo(instance);
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    markers.current = L.layerGroup().addTo(instance);
    map.current = instance;
    const resizeObserver = new ResizeObserver(() => instance.invalidateSize({ animate: false, pan: false }));
    resizeObserver.observe(element.current);
    window.setTimeout(() => instance.invalidateSize(), 0);
    return () => { resizeObserver.disconnect(); instance.remove(); map.current = null; markers.current = null; };
  }, []);

  useEffect(() => {
    const instance = map.current;
    const layer = markers.current;
    if (!instance || !layer) return;
    layer.clearLayers();
    const stops: Array<[number, number]> = [];
    const addPoint = (point: MapPoint, color: string) => {
      const location: [number, number] = [point.latitude, point.longitude];
      stops.push(location);
      L.circleMarker(location, { radius: 9, color: '#ffffff', weight: 3, fillColor: color, fillOpacity: 1 })
        .bindTooltip(`${point.label} · ${point.name}`, { direction: 'top', offset: [0, -8], opacity: 1 })
        .addTo(layer);
    };
    addPoint(pickup, pickup.label === 'Kurir' ? '#7c3aed' : '#0ea5e9');
    addPoint(destination, '#16a34a');
    if (courier && ![pickup, destination].some((point) => point.latitude === courier.latitude && point.longitude === courier.longitude)) {
      addPoint(courier, '#7c3aed');
    }
    const routeCoordinates = route?.geometry.type === 'LineString' && route.geometry.coordinates.length > 1
      && route.geometry.coordinates.every(([longitude, latitude]) => Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
        && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90)
      ? route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number])
      : null;
    L.polyline(routeCoordinates ?? [pickup, destination].map(({ latitude, longitude }) => [latitude, longitude] as [number, number]), {
      color: '#0284c7', weight: 4, opacity: 0.8, ...(routeCoordinates ? {} : { dashArray: '8 8' }),
    }).addTo(layer);
    const boundsPoints = routeCoordinates ? [...stops, ...routeCoordinates] : stops;
    if (boundsPoints.length > 1) instance.fitBounds(L.latLngBounds(boundsPoints), { padding: [32, 32], maxZoom: 15 });
    else instance.setView(stops[0], 14);
    window.setTimeout(() => instance.invalidateSize(), 0);
  }, [pickup, destination, courier, route]);

  return <div className="relative h-full min-h-56 w-full">
    <div ref={element} className="h-full min-h-56 w-full bg-slate-100" aria-label="Peta lokasi jemput dan tujuan" />
    {!route && <span className="pointer-events-none absolute left-3 top-3 z-[400] rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-medium text-stone-600 shadow-sm">Rute perkiraan</span>}
  </div>;
}
