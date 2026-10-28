ALTER TABLE service_tickets
  ADD COLUMN IF NOT EXISTS assignment_type varchar(10),
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'service_tickets_assignment_type_check'
  ) THEN
    ALTER TABLE service_tickets
      ADD CONSTRAINT service_tickets_assignment_type_check
      CHECK (assignment_type IN ('AUTO', 'MANUAL'));
  END IF;
END $$;

UPDATE service_tickets
SET assignment_type = 'MANUAL',
    assigned_at = COALESCE(updated_at, created_at)
WHERE technician_id IS NOT NULL
  AND assignment_type IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_tenant_tech_assigned
  ON service_tickets (tenant_id, technician_id, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_assignment_type
  ON service_tickets (tenant_id, assignment_type, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_active_workload
  ON service_tickets (tenant_id, technician_id)
  WHERE current_status IN ('antrian', 'pengecekan', 'menunggu_part', 'pengerjaan', 'quality_check');

CREATE TABLE IF NOT EXISTS ticket_assignment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  ticket_id uuid NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
  from_technician_id uuid REFERENCES users(id) ON DELETE SET NULL,
  to_technician_id uuid REFERENCES users(id) ON DELETE SET NULL,
  assignment_type varchar(10) NOT NULL CHECK (assignment_type IN ('AUTO', 'MANUAL')),
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  note text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_assignment_logs_ticket
  ON ticket_assignment_logs (ticket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ticket_assignment_logs_technician
  ON ticket_assignment_logs (tenant_id, to_technician_id, created_at DESC);

ALTER TABLE ticket_assignment_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ticket_assignment_logs'
      AND policyname = 'ticket_assignment_logs_tenant_policy'
  ) THEN
    CREATE POLICY ticket_assignment_logs_tenant_policy ON ticket_assignment_logs
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;

CREATE TRIGGER trg_tenant_ticket_assignment_logs
  BEFORE INSERT OR UPDATE ON ticket_assignment_logs
  FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_match(
    'ticket_id.service_tickets',
    'from_technician_id.users',
    'to_technician_id.users',
    'assigned_by.users'
  );
