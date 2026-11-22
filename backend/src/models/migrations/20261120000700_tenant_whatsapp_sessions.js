import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261120000700_tenant_whatsapp_sessions.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS public.idx_notification_logs_tenant_type_created;
    DELETE FROM public.notification_logs WHERE notification_type = 'connection_test' AND customer_id IS NULL;
    ALTER TABLE public.notification_logs
      DROP CONSTRAINT IF EXISTS ck_notification_logs_type,
      DROP COLUMN IF EXISTS notification_type,
      ALTER COLUMN customer_id SET NOT NULL;
    DROP INDEX IF EXISTS public.uq_tenant_notification_settings_openwa_session;
    ALTER TABLE public.tenant_notification_settings
      DROP COLUMN IF EXISTS openwa_session_id,
      DROP COLUMN IF EXISTS openwa_session_status,
      DROP COLUMN IF EXISTS openwa_connected_phone,
      DROP COLUMN IF EXISTS openwa_verified_at;
  `);
}
