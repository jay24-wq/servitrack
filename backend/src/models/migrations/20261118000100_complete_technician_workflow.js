import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '20261118000100_complete_technician_workflow.sql'), 'utf8');

export async function up(knex) {
  await knex.raw(sql);

  // Preserve existing approval links while removing plaintext tokens from storage.
  const quotations = await knex('quotations').select('id', 'approval_token').whereNotNull('approval_token');
  for (const quotation of quotations) {
    await knex('quotations').where({ id: quotation.id }).update({
      approval_token_hash: createHash('sha256').update(quotation.approval_token).digest('hex'),
      approval_token: null,
    });
  }
}

export async function down() {
  throw new Error('Migration workflow teknisi bersifat forward-only agar token plaintext tidak dipulihkan.');
}
