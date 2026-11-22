export const MAX_INSPECTION_LENGTH = 4000;

export function mergeInspectionResult(diagnosis: unknown, legacyNote?: unknown) {
  const main = String(diagnosis ?? '').trim();
  const legacy = String(legacyNote ?? '').trim();
  if (!legacy || main.includes(legacy)) return main || legacy;
  if (!main) return legacy;
  return `${main}\n${legacy}`;
}

export interface LegacyInspectionRow {
  id: string;
  technician_diagnosis: string | null;
  technician_note: string | null;
}

export function planLegacyInspectionMerge(rows: LegacyInspectionRow[]) {
  return rows.flatMap((row) => {
    const legacyNote = String(row.technician_note ?? '').trim();
    const merged = legacyNote
      ? mergeInspectionResult(row.technician_diagnosis, legacyNote)
      : String(row.technician_diagnosis ?? '');
    if (merged.length > MAX_INSPECTION_LENGTH) {
      throw new Error(`Tiket ${row.id} memiliki Hasil Pemeriksaan Teknisi lebih dari ${MAX_INSPECTION_LENGTH} karakter; data perlu ditinjau sebelum migration.`);
    }
    return merged === (row.technician_diagnosis ?? '') ? [] : [{ ...row, merged }];
  });
}

export function planLegacyInspectionRollback(rows: Array<{
  id: string;
  technician_diagnosis: string | null;
  technician_diagnosis_before: string | null;
  technician_note_before: string | null;
  technician_diagnosis_merged: string | null;
}>) {
  return rows.flatMap((row) => row.technician_diagnosis === row.technician_diagnosis_merged
    ? [{ ticketId: row.id, diagnosis: row.technician_diagnosis_before, legacyNote: row.technician_note_before }]
    : []);
}
