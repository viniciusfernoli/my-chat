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
  hasHydrated: boolean;

  // Actions
  setUser: (user: IUser | null) => void;
  setToken: (token: string | null) => void;
  setSecretKey: (secretKey: string | null) => void;
  setKeyPair: (keyPair: { publicKey: string; secretKey: string } | null) => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (state: boolean) => void;
  login: (user: IUser, token: string, keyPair: { publicKey: string; secretKey: string }) => void;
  logout: () => void;
  rehydrateAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      secretKey: null,
      keyPair: null,
      isAuthenticated: false,
      isLoading: true,
      hasHydrated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      setSecretKey: (secretKey) => set({ secretKey }),
      setKeyPair: (keyPair) => set({ keyPair }),
      setLoading: (isLoading) => set({ isLoading }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

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

      rehydrateAuth: async () => {
        const { token, keyPair, user } = get();
        
        // Se já tem usuário, não precisa fazer nada
        if (user) {
          set({ isLoading: false, isAuthenticated: true });
          return;
        }

        // Se não tem token nem keyPair, não está autenticado
        if (!token || !keyPair) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          // Buscar dados do usuário usando o keyPair.publicKey como ID
          // Primeiro precisamos descobrir o userId através da publicKey
          const res = await fetch('/api/users?publicKey=' + encodeURIComponent(keyPair.publicKey));
          
          if (res.ok) {
            const users = await res.json();
            if (users && users.length > 0) {
              const userData = users[0];
              set({
                user: userData,
                isAuthenticated: true,
                isLoading: false,
              });
              return;
            }
          }

          // Se não encontrou, limpar autenticação
          set({
            user: null,
            token: null,
            keyPair: null,
            isAuthenticated: false,
            isLoading: false,
          });
        } catch (error) {
          console.error('Erro ao rehydratar autenticação:', error);
          set({
            user: null,
            token: null,
            keyPair: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        keyPair: state.keyPair,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
          // Se tem user persistido, marcar como autenticado
          if (state.user && state.token && state.keyPair) {
            state.setUser(state.user);
            state.setLoading(false);
          } else if (state.token && state.keyPair) {
            // Tem token mas não tem user, precisa revalidar
            state.rehydrateAuth();
          } else {
            state.setLoading(false);
          }
        }
      },
    }
  )
);
