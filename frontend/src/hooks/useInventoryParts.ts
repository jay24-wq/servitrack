import { useQuery } from '@tanstack/react-query';
import { getInventoryParts } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useBranchStore } from '../store/branchStore';

export function useInventoryParts(status = 'active', enabled = true) {
  const tenantId = useAuthStore((state) => state.user?.tenant_id ?? null);
  const userBranchId = useAuthStore((state) => state.user?.branch_id ?? null);
  const selectedBranchId = useBranchStore((state) => state.currentBranch?.id ?? null);
  const branchId = selectedBranchId ?? userBranchId;

  return useQuery({
    queryKey: ['inventory-parts', status, tenantId, branchId],
    queryFn: () => getInventoryParts(status),
    enabled,
  });
}
