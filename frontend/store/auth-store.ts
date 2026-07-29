import { create } from 'zustand';
import { api } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // start loading so checkAuth can run smoothly

  login: async (credentials) => {
    try {
      const response = await api.login(credentials);
      if (response.success) {
        set({
          user: response.user,
          isAuthenticated: true,
        });
      }
    } catch (error) {
      throw error;
    }
  },

  logout: async () => {
    try {
      // Best effort backend logout call if it exists
      await api.logout().catch(() => {});
    } finally {
      set({ user: null, isAuthenticated: false });
    }
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true });
      const response = await api.checkAuth();
      if (response.success && response.user) {
        set({
          user: response.user,
          isAuthenticated: true,
        });
      } else {
        set({ user: null, isAuthenticated: false });
      }
    } catch (error) {
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
