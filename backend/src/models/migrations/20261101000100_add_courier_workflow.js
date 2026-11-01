import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261101000100_add_courier_workflow.sql'), 'utf8');
export async function up(knex) { await knex.raw(sql); }
export async function down(knex) {
  await knex.raw('DROP TABLE IF EXISTS courier_assignment_audits, courier_location_events, courier_proofs, courier_assignments CASCADE');
}
