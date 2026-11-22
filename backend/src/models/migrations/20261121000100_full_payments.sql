ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS service_fee numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.invoices SET status = 'unpaid' WHERE status = 'partial';
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS ck_invoices_status;
ALTER TABLE public.invoices
  ADD CONSTRAINT ck_invoices_status CHECK (status IN ('unpaid', 'paid', 'cancelled'));

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS reference_no varchar(120),
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS gateway varchar(30),
  ADD COLUMN IF NOT EXISTS order_id varchar(50),
  ADD COLUMN IF NOT EXISTS gateway_transaction_id varchar(100),
  ADD COLUMN IF NOT EXISTS gateway_payment_type varchar(40),
  ADD COLUMN IF NOT EXISTS gateway_status varchar(40),
  ADD COLUMN IF NOT EXISTS snap_token varchar(100),
  ADD COLUMN IF NOT EXISTS snap_url text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key varchar(100),
  ADD COLUMN IF NOT EXISTS is_full_settlement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cash_received numeric(12,2),
  ADD COLUMN IF NOT EXISTS change_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS refund_reason text,
  ADD COLUMN IF NOT EXISTS refund_reference varchar(120),
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS ck_payments_method;
ALTER TABLE public.payments
  ADD CONSTRAINT ck_payments_method CHECK (method IN ('cash', 'qris', 'va', 'ewallet', 'bank_transfer', 'qris_static', 'edc', 'midtrans'));

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS ck_payments_status;
ALTER TABLE public.payments
  ADD CONSTRAINT ck_payments_status CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'cancelled', 'refunding', 'refunded', 'anomaly'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_tenant_idempotency
  ON public.payments (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_order_id
  ON public.payments (order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_full_success_per_invoice
  ON public.payments (invoice_id) WHERE is_full_settlement AND status = 'paid';
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_active_midtrans_per_invoice
  ON public.payments (invoice_id) WHERE gateway = 'midtrans' AND status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payments_tenant_status_created
  ON public.payments (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_gateway_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE RESTRICT,
  payment_id uuid REFERENCES public.payments(id) ON DELETE RESTRICT,
  gateway varchar(30) NOT NULL,
  order_id varchar(50),
  payload jsonb NOT NULL,
  signature_valid boolean,
  result varchar(60) NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_gateway_webhook_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_gateway_webhook_logs_tenant_policy ON public.payment_gateway_webhook_logs;
CREATE POLICY payment_gateway_webhook_logs_tenant_policy ON public.payment_gateway_webhook_logs
  USING (tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id IS NULL OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_webhook_logs_tenant_received
  ON public.payment_gateway_webhook_logs (tenant_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_webhook_logs_order
  ON public.payment_gateway_webhook_logs (order_id, received_at DESC);

CREATE TABLE IF NOT EXISTS public.tenant_payment_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  bank_name varchar(100),
  bank_account_name varchar(120),
  bank_account_number varchar(80),
  static_qris_image_url text,
  ewallet_provider varchar(80),
  ewallet_account varchar(120),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_payment_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_payment_settings_tenant_policy ON public.tenant_payment_settings;
CREATE POLICY tenant_payment_settings_tenant_policy ON public.tenant_payment_settings
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS handed_over_by uuid REFERENCES public.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS handed_over_at timestamptz;

ALTER TABLE public.ticket_status_logs ALTER COLUMN changed_by DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.assert_full_payment_amount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE invoice_total numeric(12,2);
BEGIN
  IF NEW.is_full_settlement THEN
    SELECT total INTO invoice_total FROM public.invoices
      WHERE id = NEW.invoice_id AND tenant_id = NEW.tenant_id;
    IF invoice_total IS NULL OR NEW.amount <> invoice_total THEN
      RAISE EXCEPTION 'Pembayaran harus sama dengan total invoice';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assert_full_payment_amount ON public.payments;
CREATE TRIGGER trg_assert_full_payment_amount
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.assert_full_payment_amount();

CREATE OR REPLACE FUNCTION public.prevent_invoice_snapshot_edits()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF ROW(NEW.tenant_id, NEW.ticket_id, NEW.invoice_no, NEW.subtotal, NEW.service_fee,
         NEW.pickup_fee, NEW.additional_cost, NEW.discount, NEW.total, NEW.line_items, NEW.issued_at)
     IS DISTINCT FROM
     ROW(OLD.tenant_id, OLD.ticket_id, OLD.invoice_no, OLD.subtotal, OLD.service_fee,
         OLD.pickup_fee, OLD.additional_cost, OLD.discount, OLD.total, OLD.line_items, OLD.issued_at) THEN
    RAISE EXCEPTION 'Snapshot invoice yang sudah diterbitkan tidak dapat diubah';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_invoice_snapshot_edits ON public.invoices;
CREATE TRIGGER trg_prevent_invoice_snapshot_edits
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.prevent_invoice_snapshot_edits();

CREATE OR REPLACE FUNCTION public.prevent_payment_edits()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Pembayaran tidak dapat dihapus';
  END IF;
  IF ROW(NEW.tenant_id, NEW.invoice_id, NEW.received_by, NEW.method, NEW.amount, NEW.gateway_ref,
         NEW.reference_no, NEW.proof_url, NEW.gateway, NEW.order_id, NEW.idempotency_key,
         NEW.is_full_settlement, NEW.cash_received, NEW.change_amount)
     IS DISTINCT FROM
     ROW(OLD.tenant_id, OLD.invoice_id, OLD.received_by, OLD.method, OLD.amount, OLD.gateway_ref,
         OLD.reference_no, OLD.proof_url, OLD.gateway, OLD.order_id, OLD.idempotency_key,
         OLD.is_full_settlement, OLD.cash_received, OLD.change_amount) THEN
    RAISE EXCEPTION 'Rincian pembayaran tidak dapat diubah';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_payment_edits ON public.payments;
CREATE TRIGGER trg_prevent_payment_edits
  BEFORE UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_payment_edits();

CREATE OR REPLACE FUNCTION public.assert_tenant_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  spec text;
  child_col text;
  parent_table text;
  child_tenant uuid;
  child_value text;
  parent_tenant uuid;
BEGIN
  child_tenant := (to_jsonb(NEW) ->> 'tenant_id')::uuid;
  IF child_tenant IS NULL THEN RETURN NEW; END IF;
  FOREACH spec IN ARRAY TG_ARGV LOOP
    child_col := split_part(spec, '.', 1);
    parent_table := split_part(spec, '.', 2);
    child_value := to_jsonb(NEW) ->> child_col;
    IF child_value IS NULL THEN CONTINUE; END IF;
    EXECUTE format('SELECT tenant_id FROM %I WHERE id = $1', parent_table)
      INTO parent_tenant USING child_value::uuid;
    IF parent_tenant IS DISTINCT FROM child_tenant THEN
      RAISE EXCEPTION 'tenant mismatch: %.% (%) bukan milik tenant %', TG_TABLE_NAME, child_col, child_value, child_tenant;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_service_tickets ON public.service_tickets;
CREATE TRIGGER trg_tenant_service_tickets BEFORE INSERT OR UPDATE ON public.service_tickets
  FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_match(
    'branch_id.branches', 'booking_id.bookings', 'customer_id.customers', 'device_id.devices',
    'received_by.users', 'technician_id.users', 'handed_over_by.users'
  );

DROP TRIGGER IF EXISTS trg_tenant_payment_settings ON public.tenant_payment_settings;
CREATE TRIGGER trg_tenant_payment_settings BEFORE INSERT OR UPDATE ON public.tenant_payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_match('updated_by.users');
