-- =====================================================================
-- ServiTrack - snapshot ongkir pickup/delivery
-- =====================================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pickup_fee NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN bookings.pickup_fee IS 'Snapshot biaya pickup/delivery saat booking dibuat (Rp)';

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS pickup_fee NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN invoices.pickup_fee IS 'Snapshot ongkir booking yang dibebankan pada invoice (Rp)';
