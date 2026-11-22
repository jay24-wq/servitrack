import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261120000100_ticket_idempotency.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw(`
    DROP INDEX IF EXISTS public.uq_service_tickets_tenant_idempotency_key;
    ALTER TABLE public.service_tickets DROP COLUMN IF EXISTS idempotency_key;
  `);
}
