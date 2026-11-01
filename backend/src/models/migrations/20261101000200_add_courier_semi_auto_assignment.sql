ALTER TABLE users ADD COLUMN IF NOT EXISTS courier_status varchar(20) NOT NULL DEFAULT 'OFFLINE';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_users_courier_status') THEN
    ALTER TABLE users ADD CONSTRAINT ck_users_courier_status CHECK (courier_status IN ('ONLINE', 'OFFLINE'));
  END IF;
END $$;

ALTER TABLE courier_assignments ALTER COLUMN courier_id DROP NOT NULL;
ALTER TABLE courier_assignments ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE courier_assignments ADD COLUMN IF NOT EXISTS reassigned_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE courier_assignments ADD COLUMN IF NOT EXISTS assignment_reason text;
ALTER TABLE courier_assignments ADD COLUMN IF NOT EXISTS reassignment_reason text;
ALTER TABLE courier_assignments DROP CONSTRAINT IF EXISTS courier_assignments_status_check;
ALTER TABLE courier_assignments ADD CONSTRAINT courier_assignments_status_check CHECK (status IN (
  'MENUNGGU_ASSIGNMENT', 'MENUNGGU_PICKUP', 'KURIR_DITUGASKAN', 'MENUJU_LOKASI', 'TIBA_DI_LOKASI',
  'PERANGKAT_DIJEMPUT', 'MENUNGGU_CHECK_IN', 'SIAP_DIANTAR', 'MENUJU_CUSTOMER', 'SAMPAI_DI_LOKASI',
  'PERANGKAT_DISERAHKAN', 'SELESAI', 'PICKUP_FAILED', 'DELIVERY_FAILED', 'CUSTOMER_NOT_HOME',
  'CUSTOMER_CANCELLED', 'WRONG_ADDRESS', 'UNREACHABLE'
));

CREATE OR REPLACE FUNCTION public.assert_courier_assignment_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE booking_tenant uuid; booking_branch uuid; ticket_tenant uuid; ticket_branch uuid; courier_tenant uuid; courier_branch uuid;
BEGIN
  IF NEW.courier_id IS NOT NULL THEN
    SELECT tenant_id, branch_id INTO courier_tenant, courier_branch FROM users WHERE id = NEW.courier_id;
    IF courier_tenant IS DISTINCT FROM NEW.tenant_id OR courier_branch IS DISTINCT FROM NEW.branch_id THEN RAISE EXCEPTION 'courier must belong to assignment tenant and branch'; END IF;
  END IF;
  IF NEW.assignment_type = 'pickup' THEN
    SELECT tenant_id, branch_id INTO booking_tenant, booking_branch FROM bookings WHERE id = NEW.booking_id;
    IF booking_tenant IS DISTINCT FROM NEW.tenant_id OR booking_branch IS DISTINCT FROM NEW.branch_id THEN RAISE EXCEPTION 'booking must belong to assignment tenant and branch'; END IF;
  ELSE
    SELECT tenant_id, branch_id INTO ticket_tenant, ticket_branch FROM service_tickets WHERE id = NEW.ticket_id;
    IF ticket_tenant IS DISTINCT FROM NEW.tenant_id OR ticket_branch IS DISTINCT FROM NEW.branch_id THEN RAISE EXCEPTION 'ticket must belong to assignment tenant and branch'; END IF;
  END IF;
  RETURN NEW;
END $$;
