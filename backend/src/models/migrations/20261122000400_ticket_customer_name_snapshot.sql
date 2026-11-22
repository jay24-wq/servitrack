ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS customer_name varchar(100);

COMMENT ON COLUMN public.service_tickets.customer_name IS
  'Nama pemilik/pengantar perangkat pada saat tiket dibuat; terpisah dari akun kontak WhatsApp.';

UPDATE public.service_tickets AS t
SET customer_name = COALESCE(
  NULLIF(BTRIM((
    SELECT b.customer_name
    FROM public.bookings AS b
    WHERE b.id = t.booking_id
      AND b.tenant_id = t.tenant_id
      AND b.branch_id = t.branch_id
  )), ''),
  (
    SELECT c.name
    FROM public.customers AS c
    WHERE c.id = t.customer_id
      AND c.tenant_id = t.tenant_id
  )
)
WHERE NULLIF(BTRIM(t.customer_name), '') IS NULL;
