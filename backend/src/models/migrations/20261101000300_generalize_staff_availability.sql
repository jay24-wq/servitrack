-- Keep the legacy column name for compatibility; it now represents availability for every staff role.
UPDATE users SET courier_status = 'OFFLINE' WHERE courier_status NOT IN ('ONLINE', 'OFFLINE');
ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_courier_status;
ALTER TABLE users ADD CONSTRAINT ck_users_courier_status CHECK (courier_status IN ('ONLINE', 'OFFLINE'));
COMMENT ON COLUMN users.courier_status IS 'Legacy column name. Staff availability for all roles: ONLINE or OFFLINE.';

CREATE OR REPLACE FUNCTION public.auto_offline_staff()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected integer;
BEGIN
  UPDATE users SET courier_status = 'OFFLINE', updated_at = now() WHERE courier_status = 'ONLINE';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END $$;
