import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { IUser } from '@/types';

interface AuthState {
  user: IUser | null;
  token: string | null;
  secretKey: string | null;
  keyPair: {
    publicKey: string;
    secretKey: string;
  } | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: IUser | null) => void;
  setToken: (token: string | null) => void;
  setSecretKey: (secretKey: string | null) => void;
  setKeyPair: (keyPair: { publicKey: string; secretKey: string } | null) => void;
  setLoading: (loading: boolean) => void;
  login: (user: IUser, token: string, keyPair: { publicKey: string; secretKey: string }) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      secretKey: null,
      keyPair: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      setSecretKey: (secretKey) => set({ secretKey }),
      setKeyPair: (keyPair) => set({ keyPair }),
      setLoading: (isLoading) => set({ isLoading }),

      login: (user, token, keyPair) =>
        set({
          user,
          token,
          keyPair,
          isAuthenticated: true,
          isLoading: false,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          secretKey: null,
          keyPair: null,
          isAuthenticated: false,
          isLoading: false,
        }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        keyPair: state.keyPair,
      }),
    }
  )
);
