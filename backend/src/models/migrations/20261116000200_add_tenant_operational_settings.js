import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261116000200_add_tenant_operational_settings.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS tenant_operating_hours');
  await knex.raw(`
    ALTER TABLE tenants
      DROP CONSTRAINT IF EXISTS ck_tenants_default_booking_capacity,
      DROP CONSTRAINT IF EXISTS ck_tenants_tracking_prefix_format,
      DROP COLUMN IF EXISTS default_booking_capacity,
      DROP COLUMN IF EXISTS tracking_prefix;
  `);
}
