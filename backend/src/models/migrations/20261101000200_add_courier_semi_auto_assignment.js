import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261101000200_add_courier_semi_auto_assignment.sql'), 'utf8');
export async function up(knex) { await knex.raw(sql); }
export async function down(knex) {
  await knex.schema.alterTable('courier_assignments', (table) => {
    table.dropColumn('assigned_by'); table.dropColumn('reassigned_by'); table.dropColumn('assignment_reason'); table.dropColumn('reassignment_reason');
  });
  await knex.raw('ALTER TABLE courier_assignments ALTER COLUMN courier_id SET NOT NULL');
}
