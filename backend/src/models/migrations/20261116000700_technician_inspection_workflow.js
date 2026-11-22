import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261116000700_technician_inspection_workflow.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw(`
    UPDATE public.service_tickets SET current_status = 'pengecekan' WHERE current_status = 'menunggu_persetujuan';
    UPDATE public.service_tickets SET current_status = 'selesai' WHERE current_status = 'batal';
    UPDATE public.ticket_status_logs SET from_status = 'pengecekan' WHERE from_status = 'menunggu_persetujuan';
    UPDATE public.ticket_status_logs SET to_status = 'pengecekan' WHERE to_status = 'menunggu_persetujuan';
    UPDATE public.ticket_status_logs SET from_status = 'selesai' WHERE from_status = 'batal';
    UPDATE public.ticket_status_logs SET to_status = 'selesai' WHERE to_status = 'batal';
    UPDATE public.ticket_status_logs sl
       SET changed_by = t.received_by
      FROM public.service_tickets t
     WHERE sl.ticket_id = t.id AND sl.changed_by IS NULL;

    DROP FUNCTION IF EXISTS public.resolve_tenant_by_quotation_token(text);
    DROP INDEX IF EXISTS public.idx_tickets_tenant_diagnosis;
    DROP TRIGGER IF EXISTS trg_tenant_service_tickets ON public.service_tickets;
    CREATE TRIGGER trg_tenant_service_tickets
      BEFORE INSERT OR UPDATE ON public.service_tickets
      FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_match(
        'branch_id.branches', 'customer_id.customers', 'device_id.devices',
        'received_by.users', 'technician_id.users'
      );

    ALTER TABLE public.ticket_status_logs
      DROP CONSTRAINT IF EXISTS ticket_status_logs_from_status_check,
      DROP CONSTRAINT IF EXISTS ticket_status_logs_to_status_check,
      ALTER COLUMN changed_by SET NOT NULL,
      ADD CONSTRAINT ticket_status_logs_from_status_check CHECK (
        from_status IS NULL OR from_status IN ('antrian', 'pengecekan', 'menunggu_part', 'pengerjaan', 'quality_check', 'selesai', 'siap_diambil')
      ),
      ADD CONSTRAINT ticket_status_logs_to_status_check CHECK (
        to_status IN ('antrian', 'pengecekan', 'menunggu_part', 'pengerjaan', 'quality_check', 'selesai', 'siap_diambil')
      );

    ALTER TABLE public.service_tickets
      DROP CONSTRAINT IF EXISTS service_tickets_current_status_check,
      DROP CONSTRAINT IF EXISTS service_tickets_work_type_check,
      DROP CONSTRAINT IF EXISTS service_tickets_diagnosis_status_check,
      DROP CONSTRAINT IF EXISTS service_tickets_requested_part_qty_check,
      DROP CONSTRAINT IF EXISTS service_tickets_requested_part_pair_check,
      DROP CONSTRAINT IF EXISTS service_tickets_workflow_resolution_check,
      DROP COLUMN IF EXISTS work_type,
      DROP COLUMN IF EXISTS diagnosis_status,
      DROP COLUMN IF EXISTS technician_diagnosis,
      DROP COLUMN IF EXISTS additional_damage,
      DROP COLUMN IF EXISTS technician_note,
      DROP COLUMN IF EXISTS requested_part_id,
      DROP COLUMN IF EXISTS requested_part_qty,
      DROP COLUMN IF EXISTS workflow_resolution,
      DROP COLUMN IF EXISTS cancelled_at,
      ADD CONSTRAINT service_tickets_current_status_check CHECK (current_status IN (
        'antrian', 'pengecekan', 'menunggu_part', 'pengerjaan', 'quality_check', 'selesai', 'siap_diambil'
      ));
  `);
}
