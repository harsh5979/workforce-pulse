import { create } from 'zustand';
import { api } from '@/lib/api-client';

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true, // start loading so checkAuth can run smoothly

  login: async (credentials) => {
    try {
      const response = await api.login(credentials);
      if (response.success) {
        set({
          user: response.user,
          token: response.token,
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
      // Always clear client state and clear cookie via client if needed
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true });
      const response = await api.checkAuth();
      if (response.success && response.user) {
        set({
          user: response.user,
          // If token isn't returned by /me, just keep whatever is in memory or let HttpOnly cookie handle it
          isAuthenticated: true,
        });
      } else {
        set({ user: null, token: null, isAuthenticated: false });
      }
    } catch (error) {
      set({ user: null, token: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));
