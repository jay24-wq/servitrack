import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '20261117000100_add_service_fee_to_tickets.sql'),
  'utf8'
);

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw(`
    ALTER TABLE public.service_tickets
      DROP CONSTRAINT IF EXISTS service_tickets_service_fee_check,
      DROP COLUMN IF EXISTS service_fee;
  `);
}
