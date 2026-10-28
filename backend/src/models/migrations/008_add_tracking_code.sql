-- 008_add_tracking_code.sql
-- Nomor resi customer: SRV + 10 digit, dibuat sekali saat booking dan tidak berubah.
-- booking_code / ticket_code tetap internal. ticket_status_logs tidak diubah.

BEGIN;

-- ---------------------------------------------------------------------
-- 1. booking_status_logs (idempotent; sudah dibuat oleh 006)
-- ---------------------------------------------------------------------
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
    WHERE schemaname = 'public'
      AND tablename = 'booking_status_logs'
      AND policyname = 'booking_status_logs_tenant_isolation'
  ) THEN
    CREATE POLICY booking_status_logs_tenant_isolation ON public.booking_status_logs
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Kolom tracking_code
-- Source of truth: bookings. service_tickets menyimpan salinan immutable
-- agar walk-in ticket dan query tracking tetap sederhana.
-- ---------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS tracking_code varchar(13);

ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS tracking_code varchar(13);

-- ---------------------------------------------------------------------
-- 3. Generator nomor resi: SRV + 10 digit acak
-- SECURITY DEFINER supaya pengecekan unik lintas tenant tidak terhalang RLS.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_tracking_code()
RETURNS varchar(13)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code varchar(13);
  v_attempt int := 0;
BEGIN
  LOOP
    v_code := 'SRV' || lpad((floor(random() * 10000000000))::bigint::text, 10, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.bookings WHERE tracking_code = v_code
    ) AND NOT EXISTS (
      SELECT 1 FROM public.service_tickets WHERE tracking_code = v_code
    );

    v_attempt := v_attempt + 1;
    IF v_attempt >= 25 THEN
      RAISE EXCEPTION 'Gagal membuat tracking_code unik setelah 25 percobaan';
    END IF;
  END LOOP;

  RETURN v_code;
END;
$$;

-- ---------------------------------------------------------------------
-- 4. Backfill data lama
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.bookings WHERE tracking_code IS NULL LOOP
    UPDATE public.bookings
       SET tracking_code = public.generate_tracking_code()
     WHERE id = r.id;
  END LOOP;
END $$;

-- Tiket yang berasal dari booking memakai nomor resi booking yang sama.
UPDATE public.service_tickets t
   SET tracking_code = b.tracking_code
  FROM public.bookings b
 WHERE t.booking_id = b.id
   AND (t.tracking_code IS NULL OR t.tracking_code <> b.tracking_code);

-- Tiket walk-in / lama tanpa booking mendapat nomor resi sendiri.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.service_tickets WHERE tracking_code IS NULL LOOP
    UPDATE public.service_tickets
       SET tracking_code = public.generate_tracking_code()
     WHERE id = r.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 5. Constraint & index
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_bookings_tracking_code'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT uq_bookings_tracking_code UNIQUE (tracking_code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_service_tickets_tracking_code'
  ) THEN
    ALTER TABLE public.service_tickets
      ADD CONSTRAINT uq_service_tickets_tracking_code UNIQUE (tracking_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_tracking_code
  ON public.bookings (tracking_code);

CREATE INDEX IF NOT EXISTS idx_service_tickets_tracking_code
  ON public.service_tickets (tracking_code);

-- Nomor resi wajib terisi setelah backfill.
ALTER TABLE public.bookings
  ALTER COLUMN tracking_code SET NOT NULL;

ALTER TABLE public.service_tickets
  ALTER COLUMN tracking_code SET NOT NULL;

-- Default untuk insert yang tidak lewat aplikasi.
ALTER TABLE public.bookings
  ALTER COLUMN tracking_code SET DEFAULT public.generate_tracking_code();

ALTER TABLE public.service_tickets
  ALTER COLUMN tracking_code SET DEFAULT public.generate_tracking_code();

-- ---------------------------------------------------------------------
-- 6. Sinkronisasi booking -> service_tickets
-- Tiket yang dibuat dari booking selalu memakai nomor resi booking.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_ticket_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_code varchar(13);
BEGIN
  IF NEW.booking_id IS NOT NULL THEN
    SELECT b.tracking_code INTO v_code
      FROM public.bookings b
     WHERE b.id = NEW.booking_id;

    IF v_code IS NOT NULL THEN
      NEW.tracking_code := v_code;
    END IF;
  END IF;

  IF NEW.tracking_code IS NULL THEN
    NEW.tracking_code := public.generate_tracking_code();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_ticket_tracking_code ON public.service_tickets;
CREATE TRIGGER trg_sync_ticket_tracking_code
  BEFORE INSERT OR UPDATE ON public.service_tickets
  FOR EACH ROW EXECUTE FUNCTION public.sync_ticket_tracking_code();

-- ---------------------------------------------------------------------
-- 7. Nomor resi immutable setelah terisi
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.tracking_code IS NOT NULL
     AND NEW.tracking_code IS DISTINCT FROM OLD.tracking_code THEN
    RAISE EXCEPTION 'tracking_code tidak boleh berubah setelah dibuat';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_booking_tracking_code ON public.bookings;
CREATE TRIGGER trg_protect_booking_tracking_code
  BEFORE UPDATE OF tracking_code ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.protect_tracking_code();

DROP TRIGGER IF EXISTS trg_protect_ticket_tracking_code ON public.service_tickets;
CREATE TRIGGER trg_protect_ticket_tracking_code
  BEFORE UPDATE OF tracking_code ON public.service_tickets
  FOR EACH ROW EXECUTE FUNCTION public.protect_tracking_code();

-- ---------------------------------------------------------------------
-- 8. Hak akses role aplikasi
-- ---------------------------------------------------------------------
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['servitrack_app', 'app_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_status_logs TO %I', r);
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.generate_tracking_code() TO %I', r);
    END IF;
  END LOOP;
END $$;

COMMIT;
