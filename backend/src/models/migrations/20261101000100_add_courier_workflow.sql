-- Courier workflow: assignment ownership, GPS evidence, proof and reassignment audit.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_courier_assignments_link') THEN
    ALTER TABLE courier_tasks ADD CONSTRAINT ck_courier_assignments_link
      CHECK (request_id IS NOT NULL);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS courier_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  booking_id uuid REFERENCES bookings(id) ON DELETE RESTRICT,
  ticket_id uuid REFERENCES service_tickets(id) ON DELETE RESTRICT,
  courier_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assignment_type varchar(10) NOT NULL CHECK (assignment_type IN ('pickup', 'delivery')),
  status varchar(30) NOT NULL DEFAULT 'MENUNGGU_PICKUP' CHECK (status IN (
    'MENUNGGU_PICKUP', 'KURIR_DITUGASKAN', 'MENUJU_LOKASI', 'TIBA_DI_LOKASI',
    'PERANGKAT_DIJEMPUT', 'MENUNGGU_CHECK_IN', 'SIAP_DIANTAR', 'MENUJU_CUSTOMER',
    'SAMPAI_DI_LOKASI', 'PERANGKAT_DISERAHKAN', 'SELESAI', 'PICKUP_FAILED',
    'DELIVERY_FAILED', 'CUSTOMER_NOT_HOME', 'CUSTOMER_CANCELLED', 'WRONG_ADDRESS', 'UNREACHABLE'
  )),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  failure_reason varchar(40),
  failure_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_courier_assignment_link CHECK (
    (assignment_type = 'pickup' AND booking_id IS NOT NULL AND ticket_id IS NULL) OR
    (assignment_type = 'delivery' AND ticket_id IS NOT NULL)
  ),
  CONSTRAINT ck_courier_failure_notes CHECK (
    status NOT IN ('PICKUP_FAILED','DELIVERY_FAILED','CUSTOMER_NOT_HOME','CUSTOMER_CANCELLED','WRONG_ADDRESS','UNREACHABLE')
    OR (failure_reason IS NOT NULL AND length(trim(failure_notes)) > 0)
  )
);
CREATE INDEX IF NOT EXISTS idx_courier_assignments_owner ON courier_assignments (tenant_id, branch_id, courier_id, status);
CREATE INDEX IF NOT EXISTS idx_courier_assignments_schedule ON courier_assignments (tenant_id, branch_id, assigned_at);

CREATE TABLE IF NOT EXISTS courier_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES courier_assignments(id) ON DELETE CASCADE,
  type varchar(10) NOT NULL CHECK (type IN ('pickup', 'delivery')),
  photo_url varchar(500) NOT NULL,
  notes text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courier_proofs_assignment ON courier_proofs (tenant_id, assignment_id);

CREATE TABLE IF NOT EXISTS courier_location_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES courier_assignments(id) ON DELETE CASCADE,
  status varchar(30) NOT NULL,
  latitude numeric(10,7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude numeric(10,7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courier_location_assignment ON courier_location_events (tenant_id, assignment_id, recorded_at);

CREATE TABLE IF NOT EXISTS courier_assignment_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES courier_assignments(id) ON DELETE CASCADE,
  from_courier_id uuid REFERENCES users(id) ON DELETE SET NULL,
  to_courier_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  changed_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.assert_courier_assignment_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE booking_tenant uuid; booking_branch uuid; ticket_tenant uuid; ticket_branch uuid; courier_tenant uuid; courier_branch uuid;
BEGIN
  SELECT tenant_id, branch_id INTO courier_tenant, courier_branch FROM users WHERE id = NEW.courier_id;
  IF courier_tenant IS DISTINCT FROM NEW.tenant_id OR courier_branch IS DISTINCT FROM NEW.branch_id THEN RAISE EXCEPTION 'courier must belong to assignment tenant and branch'; END IF;
  IF NEW.assignment_type = 'pickup' THEN
    SELECT tenant_id, branch_id INTO booking_tenant, booking_branch FROM bookings WHERE id = NEW.booking_id;
    IF booking_tenant IS DISTINCT FROM NEW.tenant_id OR booking_branch IS DISTINCT FROM NEW.branch_id THEN RAISE EXCEPTION 'booking must belong to assignment tenant and branch'; END IF;
  ELSE
    SELECT tenant_id, branch_id INTO ticket_tenant, ticket_branch FROM service_tickets WHERE id = NEW.ticket_id;
    IF ticket_tenant IS DISTINCT FROM NEW.tenant_id OR ticket_branch IS DISTINCT FROM NEW.branch_id THEN RAISE EXCEPTION 'ticket must belong to assignment tenant and branch'; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_courier_assignment_scope ON courier_assignments;
CREATE TRIGGER trg_courier_assignment_scope BEFORE INSERT OR UPDATE ON courier_assignments FOR EACH ROW EXECUTE FUNCTION public.assert_courier_assignment_scope();

ALTER TABLE courier_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_location_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_assignment_audits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS courier_assignments_tenant_policy ON courier_assignments;
CREATE POLICY courier_assignments_tenant_policy ON courier_assignments USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
DROP POLICY IF EXISTS courier_proofs_tenant_policy ON courier_proofs;
CREATE POLICY courier_proofs_tenant_policy ON courier_proofs USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
DROP POLICY IF EXISTS courier_location_events_tenant_policy ON courier_location_events;
CREATE POLICY courier_location_events_tenant_policy ON courier_location_events USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
DROP POLICY IF EXISTS courier_assignment_audits_tenant_policy ON courier_assignment_audits;
CREATE POLICY courier_assignment_audits_tenant_policy ON courier_assignment_audits USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

INSERT INTO roles (code, name) VALUES ('kurir', 'Kurir') ON CONFLICT (code) DO NOTHING;

-- Public tracking can read only the deliberately projected courier events.
CREATE OR REPLACE FUNCTION public.courier_tracking_events(p_tracking_code text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'status', CASE e.status
      WHEN 'KURIR_DITUGASKAN' THEN 'courier_assigned'
      WHEN 'MENUJU_LOKASI' THEN 'courier_on_the_way'
      WHEN 'TIBA_DI_LOKASI' THEN 'courier_arrived'
      WHEN 'PERANGKAT_DIJEMPUT' THEN 'device_picked_up'
      WHEN 'SIAP_DIANTAR' THEN 'ready_for_delivery'
      WHEN 'MENUJU_CUSTOMER' THEN 'courier_on_the_way'
      WHEN 'PERANGKAT_DISERAHKAN' THEN 'device_received'
      ELSE lower(e.status)
    END,
    'note', NULLIF(a.failure_notes, ''), 'source', 'booking', 'createdAt', e.recorded_at
  ) ORDER BY e.recorded_at), '[]'::jsonb)
  FROM courier_location_events e
  JOIN courier_assignments a ON a.id = e.assignment_id
  LEFT JOIN bookings b ON b.id = a.booking_id
  LEFT JOIN service_tickets t ON t.id = a.ticket_id
  WHERE COALESCE(b.tracking_code, t.tracking_token) = p_tracking_code
$$;
