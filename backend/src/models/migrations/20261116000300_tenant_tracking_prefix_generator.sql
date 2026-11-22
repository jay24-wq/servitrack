ALTER TABLE public.bookings ALTER COLUMN tracking_code DROP DEFAULT;
ALTER TABLE public.service_tickets ALTER COLUMN tracking_code DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.generate_tracking_code_for_tenant(p_tenant_id uuid)
RETURNS varchar(13)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix varchar(3);
  v_code varchar(13);
  v_attempt int := 0;
BEGIN
  SELECT tracking_prefix INTO v_prefix FROM public.tenants WHERE id = p_tenant_id;
  IF v_prefix IS NULL OR v_prefix !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Prefix tracking tenant tidak valid';
  END IF;

  LOOP
    v_code := v_prefix || lpad((floor(random() * 10000000000))::bigint::text, 10, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.bookings WHERE tracking_code = v_code)
      AND NOT EXISTS (SELECT 1 FROM public.service_tickets WHERE tracking_code = v_code);

    v_attempt := v_attempt + 1;
    IF v_attempt >= 25 THEN
      RAISE EXCEPTION 'Gagal membuat tracking_code unik setelah 25 percobaan';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_booking_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tracking_code IS NULL THEN
    NEW.tracking_code := public.generate_tracking_code_for_tenant(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_booking_tracking_code ON public.bookings;
CREATE TRIGGER trg_assign_booking_tracking_code
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.assign_booking_tracking_code();

CREATE OR REPLACE FUNCTION public.sync_ticket_tracking_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_code varchar(13);
BEGIN
  IF NEW.booking_id IS NOT NULL THEN
    SELECT b.tracking_code INTO v_code FROM public.bookings b WHERE b.id = NEW.booking_id;
    IF v_code IS NOT NULL THEN
      NEW.tracking_code := v_code;
    END IF;
  END IF;

  IF NEW.tracking_code IS NULL THEN
    NEW.tracking_code := public.generate_tracking_code_for_tenant(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['servitrack_app', 'app_user'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION public.generate_tracking_code_for_tenant(uuid) TO %I', role_name);
    END IF;
  END LOOP;
END $$;
