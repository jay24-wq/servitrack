const STORE_LOCATION = {
  name: 'Lab ServiTrack Denpasar',
  address: 'Jl. Teuku Umar No. 123, Dauh Puri Kauh, Denpasar, Bali',
  lat: -8.6705,
  lng: 115.2126,
} as const;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function hitungOngkir(distanceKm: number): number {
  const baseFare = 8000;
  const dist = Math.ceil(distanceKm);
  if (dist <= 3) return baseFare;

  let total = baseFare;
  const remaining = dist - 3;

  if (remaining <= 7) {
    total += remaining * 3000;
  } else {
    total += 7 * 3000;
    const extra = dist - 10;
    if (extra <= 20) {
      total += extra * 2500;
    } else {
      total += 20 * 2500;
      total += (dist - 30) * 2000;
    }
  }

  return Math.ceil(total / 500) * 500;
}

export { STORE_LOCATION, haversineKm };
