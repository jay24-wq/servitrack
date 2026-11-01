import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261101000300_generalize_staff_availability.sql'), 'utf8');
export async function up(knex) { await knex.raw(sql); }
export async function down(knex) {
  await knex.raw("ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_courier_status; ALTER TABLE users ADD CONSTRAINT ck_users_courier_status CHECK (courier_status IN ('ONLINE', 'OFFLINE'));");
}
