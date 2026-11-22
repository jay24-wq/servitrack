ALTER TABLE tenants
  ADD COLUMN tracking_prefix varchar(3) NOT NULL DEFAULT 'SRV',
  ADD COLUMN default_booking_capacity integer NOT NULL DEFAULT 25,
  ADD CONSTRAINT ck_tenants_tracking_prefix_format
    CHECK (tracking_prefix ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT ck_tenants_default_booking_capacity
    CHECK (default_booking_capacity > 0);

CREATE TABLE tenant_operating_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  is_open boolean NOT NULL DEFAULT false,
  open_time time,
  close_time time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_operating_hours_day UNIQUE (tenant_id, weekday),
  CONSTRAINT ck_tenant_operating_hours_range
    CHECK (NOT is_open OR (open_time IS NOT NULL AND close_time IS NOT NULL AND open_time < close_time))
);

ALTER TABLE tenant_operating_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_operating_hours_tenant_policy ON tenant_operating_hours
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
