import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '015_add_part_catalog_fields.sql'),
  'utf8'
);

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.schema.alterTable('parts', (table) => {
    table.dropColumn('category');
    table.dropColumn('spec');
  });
}
