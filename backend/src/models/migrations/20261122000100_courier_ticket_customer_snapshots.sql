ALTER TABLE service_tickets
  ADD COLUMN IF NOT EXISTS customer_phone_snapshot varchar(20),
  ADD COLUMN IF NOT EXISTS customer_address_snapshot text,
  ADD COLUMN IF NOT EXISTS customer_latitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS customer_longitude numeric(10, 7);

UPDATE service_tickets AS t
SET
  customer_phone_snapshot = COALESCE(NULLIF(t.customer_phone_snapshot, ''), NULLIF(b.customer_phone, ''), c.phone_wa),
  customer_address_snapshot = COALESCE(NULLIF(t.customer_address_snapshot, ''), NULLIF(b.pickup_address, ''), NULLIF(c.address, '')),
  customer_latitude = COALESCE(t.customer_latitude, b.pickup_latitude),
  customer_longitude = COALESCE(t.customer_longitude, b.pickup_longitude)
FROM bookings AS b, customers AS c
WHERE t.booking_id = b.id
  AND t.tenant_id = b.tenant_id
  AND t.branch_id = b.branch_id
  AND t.customer_id = c.id
  AND t.tenant_id = c.tenant_id
  AND (
    t.customer_phone_snapshot IS NULL OR t.customer_phone_snapshot = '' OR
    t.customer_address_snapshot IS NULL OR t.customer_address_snapshot = '' OR
    t.customer_latitude IS NULL OR t.customer_longitude IS NULL
  );

UPDATE service_tickets AS t
SET
  customer_phone_snapshot = COALESCE(NULLIF(t.customer_phone_snapshot, ''), c.phone_wa),
  customer_address_snapshot = COALESCE(NULLIF(t.customer_address_snapshot, ''), NULLIF(c.address, ''))
FROM customers AS c
WHERE t.customer_id = c.id
  AND t.tenant_id = c.tenant_id
  AND (
    t.customer_phone_snapshot IS NULL OR t.customer_phone_snapshot = '' OR
    t.customer_address_snapshot IS NULL OR t.customer_address_snapshot = ''
  );

ALTER TABLE courier_assignments
  DROP CONSTRAINT IF EXISTS ck_courier_failure_notes;

ALTER TABLE courier_assignments
  ADD CONSTRAINT ck_courier_failure_notes CHECK (
    status NOT IN ('PICKUP_FAILED', 'DELIVERY_FAILED', 'CUSTOMER_NOT_HOME', 'CUSTOMER_CANCELLED', 'WRONG_ADDRESS', 'UNREACHABLE')
    OR (
      failure_reason IS NOT NULL AND
      (failure_reason <> 'OTHER' OR length(trim(COALESCE(failure_notes, ''))) > 0)
    )
  );
