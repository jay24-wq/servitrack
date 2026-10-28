import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '017_add_booking_customer_snapshot.sql'),
  'utf8'
);

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.schema.alterTable('bookings', (table) => {
    table.dropColumn('customer_name');
    table.dropColumn('customer_phone');
  });
}
