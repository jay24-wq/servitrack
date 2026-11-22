import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261116000400_ensure_default_booking_capacity.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw(`
    ALTER TABLE public.tenants
      DROP CONSTRAINT IF EXISTS ck_tenants_default_booking_capacity,
      DROP COLUMN IF EXISTS default_booking_capacity;
  `);
}
