import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '011_add_pickup_coordinates_to_bookings.sql'),
  'utf8'
);

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.schema.alterTable('bookings', (table) => {
    table.dropColumn('pickup_address');
    table.dropColumn('pickup_latitude');
    table.dropColumn('pickup_longitude');
  });
}
