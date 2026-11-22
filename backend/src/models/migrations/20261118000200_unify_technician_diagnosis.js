import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_INSPECTION_LENGTH, planLegacyInspectionMerge, planLegacyInspectionRollback } from '../../services/ticketInspection.ts';

const directory = dirname(fileURLToPath(import.meta.url));
const schemaSql = readFileSync(join(directory, '20261118000200_unify_technician_diagnosis.sql'), 'utf8');

const constraintsSql = `
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.service_tickets'::regclass
         AND conname = 'service_tickets_technician_diagnosis_length_check'
    ) THEN
      ALTER TABLE public.service_tickets
        ADD CONSTRAINT service_tickets_technician_diagnosis_length_check
        CHECK (technician_diagnosis IS NULL OR char_length(technician_diagnosis) <= ${MAX_INSPECTION_LENGTH});
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
       WHERE conrelid = 'public.quotations'::regclass
         AND conname = 'quotations_technician_diagnosis_snapshot_length_check'
    ) THEN
      ALTER TABLE public.quotations
        ADD CONSTRAINT quotations_technician_diagnosis_snapshot_length_check
        CHECK (technician_diagnosis_snapshot IS NULL OR char_length(technician_diagnosis_snapshot) <= ${MAX_INSPECTION_LENGTH});
    END IF;
  END $$;
  UPDATE public.quotations AS quote
     SET technician_diagnosis_snapshot = ticket.technician_diagnosis
    FROM public.service_tickets AS ticket
   WHERE ticket.id = quote.ticket_id
     AND quote.technician_diagnosis_snapshot IS NULL;
`;

export async function up(knex) {
  await knex.raw(schemaSql);

  const rows = await knex('service_tickets').select('id', 'tenant_id', 'technician_diagnosis', 'technician_note');
  // Calculate and validate every row before changing any data; never truncate legacy text.
  const changes = planLegacyInspectionMerge(rows);
  for (const row of changes) {
    await knex('technician_diagnosis_merge_backup').insert({
      ticket_id: row.id,
      tenant_id: row.tenant_id,
      technician_diagnosis_before: row.technician_diagnosis,
      technician_note_before: row.technician_note,
      technician_diagnosis_merged: row.merged,
    }).onConflict('ticket_id').ignore();
    await knex('service_tickets').where({ id: row.id }).update({ technician_diagnosis: row.merged || null });
  }

  await knex.raw(constraintsSql);
}

export async function down(knex) {
  const rows = await knex('technician_diagnosis_merge_backup as backup')
    .join('service_tickets as ticket', 'ticket.id', 'backup.ticket_id')
    .select('ticket.id', 'ticket.technician_diagnosis', 'backup.technician_diagnosis_before', 'backup.technician_note_before', 'backup.technician_diagnosis_merged');
  const restores = planLegacyInspectionRollback(rows);
  for (const row of restores) {
    await knex('service_tickets').where({ id: row.ticketId }).update({
      technician_diagnosis: row.diagnosis,
      technician_note: row.legacyNote,
    });
  }
  await knex.raw('ALTER TABLE public.service_tickets DROP CONSTRAINT IF EXISTS service_tickets_technician_diagnosis_length_check');
  // Keep diagnosis snapshots and backup rows; they may contain post-migration customer-facing data.
}
