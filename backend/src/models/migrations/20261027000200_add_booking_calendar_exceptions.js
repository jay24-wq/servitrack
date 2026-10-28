import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '018_add_booking_calendar_exceptions.sql'),
  'utf8'
);

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS booking_calendar_exceptions CASCADE');
}
