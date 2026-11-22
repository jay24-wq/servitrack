import { create } from 'zustand';
import type { BranchRecord } from '../lib/api';
import { apiClient } from '../services/api-client';

interface BranchState {
  tenantId: string | null;
  userId: string | null;
  branches: BranchRecord[];
  currentBranch: BranchRecord | null;
  setBranches: (tenantId: string, userId: string, branches: BranchRecord[], preferredBranchId?: string | null) => void;
  setBranch: (branch: BranchRecord) => void;
  clearBranches: () => void;
}

export const useBranchStore = create<BranchState>((set, get) => ({
  tenantId: null,
  userId: null,
  branches: [],
  currentBranch: null,

  setBranches: (tenantId, userId, branches, preferredBranchId) => {
    const state = get();
    const scopedBranches = branches.filter((branch) => branch.tenant_id === tenantId);
    const sameSession = state.tenantId === tenantId && state.userId === userId;
    const currentBranch = sameSession
      ? scopedBranches.find((branch) => branch.id === state.currentBranch?.id)
      : undefined;
    const selectedBranch = currentBranch
      ?? scopedBranches.find((branch) => branch.id === preferredBranchId)
      ?? scopedBranches.find((branch) => branch.is_main)
      ?? scopedBranches[0]
      ?? null;

    set({
      tenantId,
      userId,
      branches: scopedBranches,
      currentBranch: selectedBranch,
    });
    apiClient.setBranchId(selectedBranch?.id ?? null);
  },

  setBranch: (branch) => {
    const state = get();
    const scopedBranch = state.branches.find((item) => item.id === branch.id && item.tenant_id === state.tenantId);
    if (!scopedBranch) return;
    set({ currentBranch: scopedBranch });
    apiClient.setBranchId(scopedBranch.id);
  },

  clearBranches: () => {
    set({ tenantId: null, userId: null, branches: [], currentBranch: null });
    apiClient.setBranchId(null);
  },
}));
