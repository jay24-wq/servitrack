CREATE TABLE IF NOT EXISTS public.technician_diagnosis_merge_backup (
  ticket_id uuid PRIMARY KEY REFERENCES public.service_tickets (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  technician_diagnosis_before text,
  technician_note_before text,
  technician_diagnosis_merged text,
  backed_up_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.technician_diagnosis_merge_backup ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'technician_diagnosis_merge_backup'
       AND policyname = 'technician_diagnosis_merge_backup_tenant_policy'
  ) THEN
    CREATE POLICY technician_diagnosis_merge_backup_tenant_policy
      ON public.technician_diagnosis_merge_backup
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;

COMMENT ON COLUMN public.service_tickets.technician_note IS
  'DEPRECATED: merged into technician_diagnosis by migration 20261118000200; retained for compatibility and rollback.';

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS technician_diagnosis_snapshot text;
