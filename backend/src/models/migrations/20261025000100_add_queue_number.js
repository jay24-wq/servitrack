import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '016_add_queue_number.sql'),
  'utf8'
);

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS uq_bookings_dropoff_queue');
  await knex.raw('DROP INDEX IF EXISTS idx_bookings_queue_number');
  await knex.schema.alterTable('bookings', (table) => table.dropColumn('queue_number'));
}
