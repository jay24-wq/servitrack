import { describe, expect, it, vi } from 'vitest';
import { findActiveTechnician, findLeastLoadedTechnician, listTechnicianWorkload } from '../src/repositories/ticketAssignmentRepo';
import { pickAutoTechnician } from '../src/services/ticketAssignmentService';

function fakeExecutor() {
  const raw = vi.fn().mockResolvedValue({ rows: [] });
  return { executor: { raw } as any, raw };
}

describe('technician assignment query', () => {
  it('filters auto-assignment by branch without a nullable placeholder', async () => {
    const { executor, raw } = fakeExecutor();

    await findLeastLoadedTechnician(executor, 'tenant-id', 'branch-id');

    const [sql, bindings] = raw.mock.calls[0];
    expect(sql).toContain('AND u.branch_id = ?');
    expect(sql).not.toMatch(/\?\s+IS\s+NULL/i);
    expect(bindings).toEqual([
      ['antrian', 'pengecekan', 'menunggu_part', 'menunggu_persetujuan', 'pengerjaan', 'quality_check'],
      'tenant-id',
      'branch-id',
    ]);
  });

  it('still returns the selected technician through the auto-assignment service', async () => {
    const candidate = { id: 'technician-id', name: 'Teknisi', active_count: 0 };
    const raw = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [candidate] });

    const selected = await pickAutoTechnician({ raw } as any, 'tenant-id', 'branch-id');

    expect(selected).toEqual(candidate);
    expect(raw).toHaveBeenCalledTimes(2);
    expect(raw.mock.calls[1][0]).toContain('AND u.branch_id = ?');
    expect(raw.mock.calls[1][0]).not.toMatch(/\?\s+IS\s+NULL/i);
  });

  it('omits the branch predicate when workload is requested across branches', async () => {
    const { executor, raw } = fakeExecutor();

    await listTechnicianWorkload(executor, 'tenant-id');

    const [sql, bindings] = raw.mock.calls[0];
    expect(sql).not.toContain('u.branch_id = ?');
    expect(bindings).toHaveLength(2);
  });

  it('scopes workload queries when a branch is supplied', async () => {
    const { executor, raw } = fakeExecutor();

    await listTechnicianWorkload(executor, 'tenant-id', 'branch-id');

    const [sql, bindings] = raw.mock.calls[0];
    expect(sql).toContain('AND u.branch_id = ?');
    expect(bindings.slice(1)).toEqual(['tenant-id', 'branch-id']);
  });

  it('keeps the manual technician ID binding after the optional branch filter', async () => {
    const { executor, raw } = fakeExecutor();

    await findActiveTechnician(executor, 'tenant-id', 'technician-id', 'branch-id');

    const [sql, bindings] = raw.mock.calls[0];
    expect(sql).toContain('AND u.branch_id = ? AND u.id = ?');
    expect(bindings.slice(1)).toEqual(['tenant-id', 'branch-id', 'technician-id']);
  });
});
