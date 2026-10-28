-- =====================================================================
-- ServiTrack MVP: app role + grants, SECURITY DEFINER public helpers
-- 004_mvp_public_and_security.sql
-- Idempotent: aman dijalankan via psql/docker init maupun knex.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Role aplikasi (non-superuser, tanpa BYPASSRLS)
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'servitrack_app') THEN
    CREATE ROLE servitrack_app
      LOGIN PASSWORD 'app_pass'
      NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Grants: RLS tetap menegakkan isolasi tenant, hak DML diberikan.
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO servitrack_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO servitrack_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO servitrack_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO servitrack_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO servitrack_app;

-- audit_logs append-only TANPA memutus cleanup test:
-- ganti policy FOR ALL dengan SELECT/INSERT saja
DROP POLICY IF EXISTS audit_logs_tenant_policy ON audit_logs;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='audit_logs' AND policyname='audit_logs_select_policy') THEN
    CREATE POLICY audit_logs_select_policy ON audit_logs FOR SELECT
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
                 AND tablename='audit_logs' AND policyname='audit_logs_insert_policy') THEN
    CREATE POLICY audit_logs_insert_policy ON audit_logs FOR INSERT
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. resolve_tenant_by_slug — SECURITY DEFINER
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_tenant_by_slug(p_slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
    FROM public.tenants
   WHERE slug = p_slug
     AND status = 'active'
   LIMIT 1;
$$;

-- ---------------------------------------------------------------------
-- 4. track_public — SECURITY DEFINER
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_public(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.service_tickets%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT * INTO v_ticket
    FROM public.service_tickets
   WHERE ticket_code = p_code
      OR tracking_token = p_code
   LIMIT 1;

  IF v_ticket.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'ticket_code',       t.ticket_code,
    'current_status',    t.current_status,
    'service_method',    t.service_method,
    'complaint',         t.complaint,
    'estimated_done_at', t.estimated_done_at,
    'final_cost',        t.final_cost,
    'created_at',        t.created_at,
    'completed_at',      t.completed_at,
    'customer_name',     c.name,
    'device', jsonb_build_object(
      'category', d.category, 'brand', d.brand, 'model', d.model, 'serial_number', d.serial_number
    ),
    'branch_name', b.name,
    'status_logs', COALESCE((
      SELECT jsonb_agg(
               jsonb_build_object('to_status', l.to_status, 'note', l.note, 'created_at', l.created_at)
               ORDER BY l.created_at
             )
        FROM public.ticket_status_logs l
       WHERE l.ticket_id = t.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.service_tickets t
  JOIN public.customers c ON c.id = t.customer_id
  JOIN public.devices   d ON d.id = t.device_id
  JOIN public.branches  b ON b.id = t.branch_id
  WHERE t.id = v_ticket.id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_tenant_by_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_tenant_by_slug(text) TO servitrack_app;
GRANT EXECUTE ON FUNCTION public.track_public(text) TO servitrack_app;
