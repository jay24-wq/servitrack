import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261118000300_part_requests.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS public.part_requests;
    ALTER TABLE public.quotation_items
      DROP COLUMN IF EXISTS part_name_snapshot,
      DROP COLUMN IF EXISTS part_specification_snapshot,
      DROP COLUMN IF EXISTS part_is_registered;
  `);
}
