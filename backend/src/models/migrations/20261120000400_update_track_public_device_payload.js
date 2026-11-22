import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const upSql = readFileSync(join(directory, '20261120000400_update_track_public_device_payload.sql'), 'utf8');
const downSql = readFileSync(join(directory, '013_update_track_public_initial_estimate.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(upSql);
}

export async function down(knex) {
  await knex.raw(downSql);
}
