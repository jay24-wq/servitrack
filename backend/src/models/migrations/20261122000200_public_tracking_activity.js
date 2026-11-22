import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261122000200_public_tracking_activity.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw(`
    DROP FUNCTION IF EXISTS public.tracking_activity_events(text);
    DROP TABLE IF EXISTS public.courier_status_logs;
    ALTER TABLE public.tenants
      DROP CONSTRAINT IF EXISTS ck_tenants_public_tracking_contact_visibility,
      DROP COLUMN IF EXISTS public_tracking_contact_visibility;
  `);
}
