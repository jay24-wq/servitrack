export function branchIdForUser(role: string, assignedBranchId: string | null | undefined, requestedBranchId?: string) {
  const requested = requestedBranchId?.trim();
  if (role.trim().toLowerCase() === 'admin' && requested) return requested;
  return assignedBranchId ?? null;
}

export type BranchListScope =
  | { kind: 'tenant' }
  | { kind: 'branch'; branchId: string }
  | { kind: 'none' };

export function branchListScopeForUser(role: string, assignedBranchId: string | null | undefined): BranchListScope {
  if (role.trim().toLowerCase() === 'admin') return { kind: 'tenant' };
  return assignedBranchId ? { kind: 'branch', branchId: assignedBranchId } : { kind: 'none' };
}
