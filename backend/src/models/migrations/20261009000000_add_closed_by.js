import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '003_add_closed_by.sql'), 'utf8');
export async function up(knex) { await knex.raw(sql); }
export async function down() {}
