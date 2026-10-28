import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '008_add_tracking_code.sql'),
  'utf8'
);

export async function up(knex) {
  await knex.raw(sql);
}

export async function down() {}
