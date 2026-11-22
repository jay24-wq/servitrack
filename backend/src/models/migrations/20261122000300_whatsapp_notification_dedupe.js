import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261122000300_whatsapp_notification_dedupe.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS public.uq_notification_logs_tenant_dedupe_key;
    ALTER TABLE public.notification_logs DROP COLUMN IF EXISTS dedupe_key;
  `);
}
