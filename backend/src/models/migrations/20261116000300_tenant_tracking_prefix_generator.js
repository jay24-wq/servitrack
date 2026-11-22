import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261116000300_tenant_tracking_prefix_generator.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw('DROP TRIGGER IF EXISTS trg_assign_booking_tracking_code ON public.bookings');
  await knex.raw('DROP FUNCTION IF EXISTS public.assign_booking_tracking_code()');
  await knex.raw('DROP FUNCTION IF EXISTS public.generate_tracking_code_for_tenant(uuid)');
  await knex.raw(`
    CREATE OR REPLACE FUNCTION public.sync_ticket_tracking_code()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE v_code varchar(13);
    BEGIN
      IF NEW.booking_id IS NOT NULL THEN
        SELECT b.tracking_code INTO v_code FROM public.bookings b WHERE b.id = NEW.booking_id;
        IF v_code IS NOT NULL THEN NEW.tracking_code := v_code; END IF;
      END IF;
      IF NEW.tracking_code IS NULL THEN NEW.tracking_code := public.generate_tracking_code(); END IF;
      RETURN NEW;
    END;
    $$;
    ALTER TABLE public.bookings ALTER COLUMN tracking_code SET DEFAULT public.generate_tracking_code();
    ALTER TABLE public.service_tickets ALTER COLUMN tracking_code SET DEFAULT public.generate_tracking_code();
  `);
}
