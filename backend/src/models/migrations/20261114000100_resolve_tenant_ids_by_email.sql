CREATE OR REPLACE FUNCTION public.resolve_tenant_ids_by_email(p_email text)
RETURNS TABLE (tenant_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT DISTINCT u.tenant_id
    FROM public.users AS u
   WHERE lower(u.email) = lower(p_email)
     AND u.is_active = true
     AND u.deleted_at IS NULL
   ORDER BY u.tenant_id;
$$;

REVOKE ALL ON FUNCTION public.resolve_tenant_ids_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_tenant_ids_by_email(text) TO servitrack_app;
