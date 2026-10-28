ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS customer_name varchar(100),
  ADD COLUMN IF NOT EXISTS customer_phone varchar(20);

UPDATE bookings AS b
SET
  customer_name = c.name,
  customer_phone = c.phone_wa
FROM customers AS c
WHERE c.id = b.customer_id
  AND (b.customer_name IS NULL OR b.customer_phone IS NULL);
