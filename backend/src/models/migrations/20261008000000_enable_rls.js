import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rlsSql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '002_enable_rls.sql'),
  'utf8'
);

export async function up(knex) {
  await knex.raw(rlsSql);
}

export async function down() {
  // Tidak didukung
}
