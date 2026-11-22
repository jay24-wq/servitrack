import { create } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import { logoutRequest } from '../lib/api';
import { apiClient } from '../services/api-client';
import { useBranchStore } from './branchStore';

export type UserRole = 'ADMIN' | 'FRONTDESK' | 'TEKNISI' | 'KURIR';
export type DemoRole = 'ADMIN' | 'TEKNISI' | 'FRONTDESK' | 'KURIR';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenant_id: string;
  branch_id?: string | null;
  avatar_data_url?: string | null;
  time_zone?: string;
}

const STORAGE_KEY = 'servitrack.auth';

export const DEMO_USERS: Record<DemoRole, AuthUser> = {
  ADMIN: {
    id: 'usr-admin',
    email: 'admin@servitrack.id',
    name: 'Andra Wijaya',
    role: 'ADMIN',
    tenant_id: 't1',
  },
  TEKNISI: {
    id: 'usr-teknisi',
    email: 'teknisi@servitrack.id',
    name: 'Panendra Soma',
    role: 'TEKNISI',
    tenant_id: 't1',
  },
  FRONTDESK: {
    id: 'usr-frontdesk',
    email: 'frontdesk@servitrack.id',
    name: 'Rani Kusumawati',
    role: 'FRONTDESK',
    tenant_id: 't1',
  },
  KURIR: {
    id: 'usr-kurir',
    email: 'kurir@servitrack.id',
    name: 'Angga Saputra',
    role: 'KURIR',
    tenant_id: 't1',
  },
};

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => void;
  loginAs: (role: DemoRole) => AuthUser;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

function loadPersisted(): { user: AuthUser | null; token: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { user: null, token: null };
    const parsed = JSON.parse(raw) as { user?: AuthUser; token?: string };
    return { user: parsed.user ?? null, token: parsed.token ?? null };
  } catch {
    return { user: null, token: null };
  }
}

function persist(user: AuthUser | null, token: string | null) {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, token }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // storage unavailable, ignore
  }
}

const persisted = loadPersisted();

export const useAuthStore = create<AuthState>((set) => ({
  user: persisted.user,
  token: persisted.token,
  isAuthenticated: Boolean(persisted.user),
  isLoading: false,

  login: (token: string) => {
    const decoded = jwtDecode<any>(token);
    const user: AuthUser = {
      id: decoded.user_id ?? decoded.id,
      email: decoded.email,
      name: decoded.name ?? decoded.email,
      role: String(decoded.role).toUpperCase() as UserRole,
      tenant_id: decoded.tenant_id,
      branch_id: decoded.branch_id ?? null,
    };
    useBranchStore.getState().clearBranches();
    persist(user, token);
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  loginAs: (role: DemoRole) => {
    const user = DEMO_USERS[role];
    useBranchStore.getState().clearBranches();
    persist(user, 'demo-token');
    set({ user, token: 'demo-token', isAuthenticated: true, isLoading: false });
    return user;
  },

  logout: async () => {
    try {
      await logoutRequest();
    } catch (error) {
      console.warn('[Auth] logout request gagal; session lokal tetap dihapus', error);
    }
    apiClient.clearToken();
    useBranchStore.getState().clearBranches();
    persist(null, null);
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  setUser: (user) => {
    useBranchStore.getState().clearBranches();
    persist(user, user ? 'demo-token' : null);
    set({ user, isAuthenticated: Boolean(user) });
  },

  updateUser: (updates) => set((state) => {
    if (!state.user) return state;
    const user = { ...state.user, ...updates };
    persist(user, state.token);
    return { user };
  }),
}));

export function homeForRole(role?: UserRole | string): string {
  if (role === 'TEKNISI') return '/technician';
  if (role === 'FRONTDESK') return '/frontdesk';
  if (role === 'KURIR') return '/courier';
  return '/dashboard';
}
