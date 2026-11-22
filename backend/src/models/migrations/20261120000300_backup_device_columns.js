import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261120000300_backup_device_columns.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

// Keep the backup table so rollback remains possible after this migration is reverted.
export async function down() {}
