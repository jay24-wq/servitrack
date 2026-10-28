import { create } from 'zustand';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  plan_expires_at?: string;
  active: boolean;
}

interface TenantState {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  setTenant: (tenant: Tenant | null) => void;
  addTenant: (tenant: Tenant) => void;
  updateTenant: (id: string, data: Partial<Tenant>) => void;
}

export const useTenantStore = create<TenantState>((set) => ({
  currentTenant: null,
  tenants: [],
  
  setTenant: (tenant: Tenant | null) => {
    set({ currentTenant: tenant });
  },
  
  addTenant: (tenant: Tenant) => {
    set((state) => ({
      tenants: [...state.tenants, tenant],
    }));
  },
  
  updateTenant: (id: string, data: Partial<Tenant>) => {
    set((state) => ({
      tenants: state.tenants.map((t) => (t.id === id ? { ...t, ...data } : t)),
    }));
  },
}));
