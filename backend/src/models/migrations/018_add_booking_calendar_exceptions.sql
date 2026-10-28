CREATE TABLE IF NOT EXISTS booking_calendar_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  slot_date date NOT NULL,
  status varchar(10) NOT NULL CHECK (status IN ('closed', 'limited')),
  capacity_override integer CHECK (capacity_override IS NULL OR capacity_override > 0),
  title varchar(150) NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_booking_calendar_exceptions_branch_date UNIQUE (branch_id, slot_date)
);

CREATE INDEX IF NOT EXISTS idx_booking_calendar_exceptions_tenant_date
  ON booking_calendar_exceptions (tenant_id, slot_date);

ALTER TABLE booking_calendar_exceptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'booking_calendar_exceptions'
      AND policyname = 'booking_calendar_exceptions_tenant_policy'
  ) THEN
    CREATE POLICY booking_calendar_exceptions_tenant_policy
      ON booking_calendar_exceptions
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
  END IF;
END $$;

CREATE TRIGGER trg_tenant_booking_calendar_exceptions
  BEFORE INSERT OR UPDATE ON booking_calendar_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_match('branch_id.branches');
