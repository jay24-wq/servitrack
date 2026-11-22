-- =====================================================================
-- ServiTrack - tambah kolom pickup_area ke tabel bookings
-- =====================================================================

ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS pickup_area VARCHAR(255);