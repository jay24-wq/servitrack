import { create } from 'zustand';

interface UIState {
  mobileMenuOpen: boolean;
  sidebarOpen: boolean;
  darkMode: boolean;
  notifications: Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>;
  
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  addNotification: (type: 'success' | 'error' | 'info', message: string) => string;
  removeNotification: (id: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  mobileMenuOpen: false,
  sidebarOpen: true,
  darkMode: false,
  notifications: [],
  
  toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
  closeMobileMenu: () => set({ mobileMenuOpen: false }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  
  addNotification: (type, message) => {
    const id = Date.now().toString();
    set((state) => ({
      notifications: [...state.notifications, { id, type, message }],
    }));
    return id;
  },
  
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
}));
