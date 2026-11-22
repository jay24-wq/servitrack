import { describe, expect, it } from 'vitest';
import { MAX_INSPECTION_LENGTH, mergeInspectionResult, planLegacyInspectionMerge, planLegacyInspectionRollback } from '../src/services/ticketInspection';

describe('Hasil Pemeriksaan Teknisi', () => {
  it('menggabungkan catatan klien lama dengan pemisah baris tanpa duplikasi', () => {
    expect(mergeInspectionResult('IC charging rusak', 'Korosi pada jalur power'))
      .toBe('IC charging rusak\nKorosi pada jalur power');
    expect(mergeInspectionResult('IC charging rusak\nKorosi pada jalur power', 'Korosi pada jalur power'))
      .toBe('IC charging rusak\nKorosi pada jalur power');
    expect(mergeInspectionResult('', 'Korosi pada jalur power')).toBe('Korosi pada jalur power');
  });

  it('menggunakan satu batas panjang 4000 karakter', () => {
    expect(MAX_INSPECTION_LENGTH).toBe(4000);
    expect(mergeInspectionResult('x'.repeat(MAX_INSPECTION_LENGTH))).toHaveLength(MAX_INSPECTION_LENGTH);
  });

  it('migration data menghasilkan perubahan idempotent dan tidak membuang nilai lama', () => {
    const legacy = [{ id: 'ticket-1', technician_diagnosis: 'IC charging rusak', technician_note: 'Korosi pada jalur power' }];
    const planned = planLegacyInspectionMerge(legacy);
    expect(planned[0]).toMatchObject({
      technician_diagnosis: 'IC charging rusak',
      technician_note: 'Korosi pada jalur power',
      merged: 'IC charging rusak\nKorosi pada jalur power',
    });
    expect(planLegacyInspectionMerge([{
      ...legacy[0],
      technician_diagnosis: planned[0].merged,
    }])).toEqual([]);
    expect(planLegacyInspectionRollback([{
      id: 'ticket-1',
      technician_diagnosis: planned[0].merged,
      technician_diagnosis_before: legacy[0].technician_diagnosis,
      technician_note_before: legacy[0].technician_note,
      technician_diagnosis_merged: planned[0].merged,
    }])).toEqual([{ ticketId: 'ticket-1', diagnosis: 'IC charging rusak', legacyNote: 'Korosi pada jalur power' }]);
    expect(planLegacyInspectionRollback([{
      id: 'edited-ticket',
      technician_diagnosis: 'Hasil sudah diperbarui',
      technician_diagnosis_before: 'Lama',
      technician_note_before: 'Note lama',
      technician_diagnosis_merged: 'Lama\nNote lama',
    }])).toEqual([]);
    expect(() => planLegacyInspectionMerge([{
      id: 'overflow', technician_diagnosis: 'd'.repeat(3000), technician_note: 'n'.repeat(1001),
    }])).toThrow(/lebih dari 4000 karakter/);
  });
});
