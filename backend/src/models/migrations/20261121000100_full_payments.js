import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261121000100_full_payments.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw(`
    DROP TRIGGER IF EXISTS trg_tenant_service_tickets ON public.service_tickets;
    DROP TRIGGER IF EXISTS trg_prevent_payment_edits ON public.payments;
    DROP TRIGGER IF EXISTS trg_prevent_invoice_snapshot_edits ON public.invoices;
    DROP TRIGGER IF EXISTS trg_assert_full_payment_amount ON public.payments;
    DROP FUNCTION IF EXISTS public.assert_full_payment_amount();
    DROP FUNCTION IF EXISTS public.prevent_invoice_snapshot_edits();
    DROP FUNCTION IF EXISTS public.prevent_payment_edits();

    UPDATE public.payments SET method = CASE method
      WHEN 'bank_transfer' THEN 'va' WHEN 'qris_static' THEN 'qris' WHEN 'edc' THEN 'va'
      WHEN 'midtrans' THEN 'qris' ELSE method END;
    UPDATE public.payments SET status = 'failed' WHERE status IN ('expired', 'cancelled', 'refunding', 'refunded', 'anomaly');
    UPDATE public.invoices SET status = 'unpaid' WHERE status = 'cancelled';

    DROP INDEX IF EXISTS public.uq_payments_tenant_idempotency;
    DROP INDEX IF EXISTS public.uq_payments_order_id;
    DROP INDEX IF EXISTS public.uq_payments_full_success_per_invoice;
    DROP INDEX IF EXISTS public.uq_payments_active_midtrans_per_invoice;
    DROP INDEX IF EXISTS public.idx_payments_tenant_status_created;

    ALTER TABLE public.payments
      DROP CONSTRAINT IF EXISTS ck_payments_method,
      DROP CONSTRAINT IF EXISTS ck_payments_status,
      DROP CONSTRAINT IF EXISTS payments_method_check,
      DROP CONSTRAINT IF EXISTS payments_status_check;
    ALTER TABLE public.payments
      ADD CONSTRAINT payments_method_check CHECK (method IN ('cash', 'qris', 'va', 'ewallet')),
      ADD CONSTRAINT payments_status_check CHECK (status IN ('pending', 'paid', 'failed'));
    ALTER TABLE public.invoices
      DROP CONSTRAINT IF EXISTS ck_invoices_status,
      DROP CONSTRAINT IF EXISTS invoices_status_check;
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_status_check CHECK (status IN ('unpaid', 'partial', 'paid'));

    ALTER TABLE public.service_tickets
      DROP COLUMN IF EXISTS handed_over_at,
      DROP COLUMN IF EXISTS handed_over_by;
    UPDATE public.ticket_status_logs logs
       SET changed_by = ticket.received_by
      FROM public.service_tickets ticket
     WHERE logs.ticket_id = ticket.id AND logs.changed_by IS NULL;
    ALTER TABLE public.ticket_status_logs ALTER COLUMN changed_by SET NOT NULL;
    DROP TRIGGER IF EXISTS trg_tenant_service_tickets ON public.service_tickets;
    CREATE TRIGGER trg_tenant_service_tickets BEFORE INSERT OR UPDATE ON public.service_tickets
      FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_match(
        'branch_id.branches', 'booking_id.bookings', 'customer_id.customers', 'device_id.devices',
        'received_by.users', 'technician_id.users'
      );
    DROP TABLE IF EXISTS public.tenant_payment_settings;
    DROP TABLE IF EXISTS public.payment_gateway_webhook_logs;

    ALTER TABLE public.payments
      DROP COLUMN IF EXISTS reference_no,
      DROP COLUMN IF EXISTS proof_url,
      DROP COLUMN IF EXISTS gateway,
      DROP COLUMN IF EXISTS order_id,
      DROP COLUMN IF EXISTS gateway_transaction_id,
      DROP COLUMN IF EXISTS gateway_payment_type,
      DROP COLUMN IF EXISTS gateway_status,
      DROP COLUMN IF EXISTS snap_token,
      DROP COLUMN IF EXISTS snap_url,
      DROP COLUMN IF EXISTS expires_at,
      DROP COLUMN IF EXISTS idempotency_key,
      DROP COLUMN IF EXISTS is_full_settlement,
      DROP COLUMN IF EXISTS cash_received,
      DROP COLUMN IF EXISTS change_amount,
      DROP COLUMN IF EXISTS refund_reason,
      DROP COLUMN IF EXISTS refund_reference,
      DROP COLUMN IF EXISTS refunded_at;
    ALTER TABLE public.invoices
      DROP COLUMN IF EXISTS service_fee,
      DROP COLUMN IF EXISTS line_items;
  `);
}
