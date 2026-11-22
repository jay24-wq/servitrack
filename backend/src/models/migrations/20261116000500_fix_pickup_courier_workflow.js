import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261116000500_fix_pickup_courier_workflow.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw(`
    ALTER TABLE public.courier_assignments
      DROP CONSTRAINT IF EXISTS courier_assignments_status_check;

    UPDATE public.courier_assignments
       SET status = CASE
         WHEN status = 'PERANGKAT_TIBA_DI_WORKSHOP' THEN 'SELESAI'
         WHEN status = 'MENUJU_TOKO' THEN 'MENUNGGU_CHECK_IN'
         ELSE status
       END
     WHERE status IN ('MENUJU_TOKO', 'PERANGKAT_TIBA_DI_WORKSHOP');

    ALTER TABLE public.courier_assignments
      ADD CONSTRAINT courier_assignments_status_check CHECK (status IN (
        'MENUNGGU_ASSIGNMENT', 'MENUNGGU_PICKUP', 'KURIR_DITUGASKAN', 'MENUJU_LOKASI',
        'TIBA_DI_LOKASI', 'PERANGKAT_DIJEMPUT', 'MENUNGGU_CHECK_IN', 'SIAP_DIANTAR',
        'MENUJU_CUSTOMER', 'SAMPAI_DI_LOKASI', 'PERANGKAT_DISERAHKAN', 'SELESAI',
        'PICKUP_FAILED', 'DELIVERY_FAILED', 'CUSTOMER_NOT_HOME', 'CUSTOMER_CANCELLED',
        'WRONG_ADDRESS', 'UNREACHABLE'
      ));

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
  `);
}
