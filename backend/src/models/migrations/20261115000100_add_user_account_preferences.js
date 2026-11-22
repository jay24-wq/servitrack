import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261115000100_add_user_account_preferences.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);
}

export async function down(knex) {
  await knex.raw(`
    ALTER TABLE users
      DROP CONSTRAINT IF EXISTS ck_users_avatar_data_url_size,
      DROP COLUMN IF EXISTS avatar_data_url,
      DROP COLUMN IF EXISTS time_zone;
  `);
}
