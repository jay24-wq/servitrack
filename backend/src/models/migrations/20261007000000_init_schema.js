import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Skema awal ditulis sebagai SQL murni (001_init.sql) supaya bisa dipakai
// psql dan docker-entrypoint-initdb.d tanpa Knex. Migration ini hanya
// membaca file yang sama supaya `npm run db:migrate` tetap berjalan.
const schemaSql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '001_init.sql'),
  'utf8'
);

export async function up(knex) {
  const result = await knex.raw("select to_regclass('public.service_tickets') as table_name");
  if (result.rows[0].table_name) {
    // Skema sudah ada (diimpor lewat psql atau docker initdb), cukup dicatat.
    return;
  }
  await knex.raw(schemaSql);
}

export async function down() {
  // Tidak didukung: 001_init.sql membuat seluruh skema awal dari nol.
}
