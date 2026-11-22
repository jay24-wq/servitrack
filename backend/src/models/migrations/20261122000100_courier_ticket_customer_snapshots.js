import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261122000100_courier_ticket_customer_snapshots.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

// Keep the snapshots and relaxed optional-note rule on rollback; dropping them would discard copied customer data.
export async function down(knex) {
  await knex.raw('SELECT 1');
}
