import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261115000200_add_tenant_public_profile.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw(`
    ALTER TABLE tenants
      DROP CONSTRAINT IF EXISTS ck_tenants_description_length,
      DROP COLUMN IF EXISTS email,
      DROP COLUMN IF EXISTS description;
  `);
}
