import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261114000200_add_tenant_location_and_logo.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw(`
    ALTER TABLE tenants
      DROP CONSTRAINT IF EXISTS ck_tenants_logo_data_url_size,
      DROP CONSTRAINT IF EXISTS ck_tenants_location_pair,
      DROP CONSTRAINT IF EXISTS ck_tenants_longitude_range,
      DROP CONSTRAINT IF EXISTS ck_tenants_latitude_range,
      DROP COLUMN IF EXISTS logo_data_url,
      DROP COLUMN IF EXISTS longitude,
      DROP COLUMN IF EXISTS latitude;
  `);
}
