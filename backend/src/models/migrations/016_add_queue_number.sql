ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS queue_number varchar(10);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_dropoff_queue
  ON bookings (branch_id, slot_id, queue_number)
  WHERE service_method = 'dropoff' AND queue_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_queue_number
  ON bookings (branch_id, queue_number)
  WHERE queue_number IS NOT NULL;
