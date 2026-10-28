-- Lokasi presisi pickup. pickup_area tetap dipertahankan untuk laporan dan analitik.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pickup_address VARCHAR(500),
  ADD COLUMN IF NOT EXISTS pickup_latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS pickup_longitude NUMERIC(10,7);

COMMENT ON COLUMN bookings.pickup_address IS 'Alamat hasil reverse geocoding titik pickup';
COMMENT ON COLUMN bookings.pickup_latitude IS 'Latitude titik pickup';
COMMENT ON COLUMN bookings.pickup_longitude IS 'Longitude titik pickup';
