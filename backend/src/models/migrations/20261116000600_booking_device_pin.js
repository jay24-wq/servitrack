import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261116000600_booking_device_pin.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw(`
    ALTER TABLE public.bookings
      DROP CONSTRAINT IF EXISTS ck_bookings_device_pin_state,
      DROP COLUMN IF EXISTS device_pin_enc,
      DROP COLUMN IF EXISTS device_pin_refused;
    ALTER TABLE public.service_tickets
      DROP CONSTRAINT IF EXISTS ck_service_tickets_device_pin_state,
      DROP COLUMN IF EXISTS device_pin_enc,
      DROP COLUMN IF EXISTS device_pin_refused;
  `);
}
