import { describe, expect, it } from 'vitest';
import { branchIdForUser, branchListScopeForUser } from '../src/middleware/branchAccess';

describe('branch access policy', () => {
  it('uses a requested branch for admins before the resolver validates it', () => {
    expect(branchIdForUser('admin', 'branch-home', ' branch-selected ')).toBe('branch-selected');
  });

  it('defaults admins to their assigned branch when no branch is selected', () => {
    expect(branchIdForUser('admin', 'branch-home')).toBe('branch-home');
  });

  it.each(['frontdesk', 'teknisi', 'kurir'])('keeps %s on the assigned branch even if another is requested', (role) => {
    expect(branchIdForUser(role, 'branch-assigned', 'branch-other')).toBe('branch-assigned');
  });

  it('does not select another branch when the user has no assignment', () => {
    expect(branchIdForUser('frontdesk', null, 'branch-other')).toBeNull();
  });

  it('allows admins to list active branches in their tenant', () => {
    expect(branchListScopeForUser('admin', 'branch-home')).toEqual({ kind: 'tenant' });
  });

  it.each(['frontdesk', 'teknisi', 'kurir'])('limits %s to the assigned branch', (role) => {
    expect(branchListScopeForUser(role, 'branch-assigned')).toEqual({ kind: 'branch', branchId: 'branch-assigned' });
  });

  it('returns no branch access when a non-admin has no assignment', () => {
    expect(branchListScopeForUser('kurir', null)).toEqual({ kind: 'none' });
  });
});
