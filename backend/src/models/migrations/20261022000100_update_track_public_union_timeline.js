import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '007_update_track_public_union_timeline.sql'),
  'utf8'
);

export async function up(knex) {
  await knex.raw(sql);
}

export async function down() {}
