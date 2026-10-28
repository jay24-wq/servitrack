-- 006_add_booking_timeline.sql
-- Tambah booking_status_logs untuk timeline sejak booking dibuat

BEGIN;

CREATE TABLE IF NOT EXISTS public.booking_status_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_code varchar(40) NOT NULL,
  from_status varchar(20),
  to_status varchar(20),
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_type varchar(16),
  note text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_status_logs_tenant_booking_created
  ON public.booking_status_logs (tenant_id, booking_id, created_at);

CREATE INDEX IF NOT EXISTS idx_booking_status_logs_booking_created
  ON public.booking_status_logs (booking_id, created_at);

ALTER TABLE public.booking_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_status_logs FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'booking_status_logs' AND policyname = 'booking_status_logs_tenant_isolation'
  ) THEN
    CREATE POLICY booking_status_logs_tenant_isolation ON public.booking_status_logs
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;

-- Grant akses untuk role aplikasi (hanya bila role tersedia)
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['servitrack_app', 'app_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_status_logs TO %I', r);
    END IF;
  END LOOP;
END $$;

INSERT INTO public.booking_status_logs (tenant_id, booking_id, event_code, from_status, to_status, actor_type, note, meta, created_at)
SELECT b.tenant_id,
       b.id,
       'BOOKING_CREATED',
       NULL,
       b.status,
       'system',
       'Booking servis berhasil dibuat',
       jsonb_build_object('booking_code', b.booking_code, 'service_method', b.service_method),
       COALESCE(b.created_at, now())
FROM public.bookings b
WHERE NOT EXISTS (
  SELECT 1 FROM public.booking_status_logs l
  WHERE l.booking_id = b.id AND l.event_code = 'BOOKING_CREATED'
);

INSERT INTO public.booking_status_logs (tenant_id, booking_id, event_code, from_status, to_status, actor_type, note, meta, created_at)
SELECT b.tenant_id,
       b.id,
       'UNIT_RECEIVED',
       'booked',
       'arrived',
       'system',
       'Unit diterima cabang',
       jsonb_build_object('booking_code', b.booking_code),
       COALESCE(b.updated_at, b.created_at, now())
FROM public.bookings b
WHERE b.status = 'arrived'
  AND NOT EXISTS (
    SELECT 1 FROM public.booking_status_logs l
    WHERE l.booking_id = b.id AND l.event_code = 'UNIT_RECEIVED'
  );

INSERT INTO public.booking_status_logs (tenant_id, booking_id, event_code, actor_type, note, meta, created_at)
SELECT t.tenant_id,
       t.booking_id,
       'TICKET_ISSUED',
       'system',
       'Tiket servis diterbitkan',
       jsonb_build_object('ticket_id', t.id, 'ticket_code', t.ticket_code, 'current_status', t.current_status),
       COALESCE(t.created_at, now())
FROM public.service_tickets t
WHERE t.booking_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.booking_status_logs l
    WHERE l.booking_id = t.booking_id AND l.event_code = 'TICKET_ISSUED'
  );

COMMIT;
