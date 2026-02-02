import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { IUser } from '@/types';

// Tipos para Firebase Auth
interface FirebaseAuthState {
  firebaseToken: string | null;
  idToken: string | null;
  isFirebaseAuthenticated: boolean;
}

interface AuthState extends FirebaseAuthState {
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
  rememberMe: boolean;

  // Actions
  setUser: (user: IUser | null) => void;
  setToken: (token: string | null) => void;
  setSecretKey: (secretKey: string | null) => void;
  setKeyPair: (keyPair: { publicKey: string; secretKey: string } | null) => void;
  setLoading: (loading: boolean) => void;
  setHasHydrated: (state: boolean) => void;
  setRememberMe: (remember: boolean) => void;
  
  // Firebase Auth Actions
  setFirebaseToken: (firebaseToken: string | null) => void;
  setIdToken: (idToken: string | null) => void;
  setFirebaseAuthenticated: (isAuthenticated: boolean) => void;
  
  // Login com Firebase
  login: (
    user: IUser, 
    token: string, 
    keyPair: { publicKey: string; secretKey: string }, 
    remember?: boolean,
    firebaseToken?: string | null
  ) => Promise<void>;
  logout: () => Promise<void>;
  rehydrateAuth: () => Promise<void>;
  
  // Utilitário para obter token válido
  getValidIdToken: () => Promise<string | null>;
}

// Storage que usa localStorage ou sessionStorage baseado no rememberMe
const createCustomStorage = () => {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };
  }

  return {
    getItem: (name: string) => {
      // Tentar localStorage primeiro, depois sessionStorage
      const localData = localStorage.getItem(name);
      if (localData) return localData;
      return sessionStorage.getItem(name);
    },
    setItem: (name: string, value: string) => {
      // Verificar se devemos usar sessionStorage ou localStorage
      try {
        const parsed = JSON.parse(value);
        if (parsed?.state?.rememberMe === false) {
          // Se não quer lembrar, usar sessionStorage e limpar localStorage
          localStorage.removeItem(name);
          sessionStorage.setItem(name, value);
        } else {
          // Se quer lembrar, usar localStorage e limpar sessionStorage
          sessionStorage.removeItem(name);
          localStorage.setItem(name, value);
        }
      } catch {
        localStorage.setItem(name, value);
      }
    },
    removeItem: (name: string) => {
      localStorage.removeItem(name);
      sessionStorage.removeItem(name);
    },
  };
};

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
      rememberMe: true,
      
      // Firebase Auth state
      firebaseToken: null,
      idToken: null,
      isFirebaseAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      setSecretKey: (secretKey) => set({ secretKey }),
      setKeyPair: (keyPair) => set({ keyPair }),
      setLoading: (isLoading) => set({ isLoading }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setRememberMe: (rememberMe) => set({ rememberMe }),
      
      // Firebase Auth setters
      setFirebaseToken: (firebaseToken) => set({ firebaseToken }),
      setIdToken: (idToken) => set({ idToken }),
      setFirebaseAuthenticated: (isFirebaseAuthenticated) => set({ isFirebaseAuthenticated }),

      login: async (user, token, keyPair, remember = true, firebaseToken = null) => {
        // Se temos firebaseToken, autenticar no Firebase
        if (firebaseToken && typeof window !== 'undefined') {
          try {
            const { getFirebaseAuthManager } = await import('@/lib/db/firebase-client');
            const authManager = getFirebaseAuthManager();
            const idToken = await authManager.signInWithCustomToken(firebaseToken);
            
            set({
              user,
              token,
              keyPair,
              isAuthenticated: true,
              isLoading: false,
              rememberMe: remember,
              firebaseToken,
              idToken,
              isFirebaseAuthenticated: true,
            });
            
            console.log('[AuthStore] Login com Firebase Auth realizado com sucesso');
          } catch (error) {
            console.error('[AuthStore] Erro ao autenticar com Firebase:', error);
            // Login sem Firebase Auth (fallback)
            set({
              user,
              token,
              keyPair,
              isAuthenticated: true,
              isLoading: false,
              rememberMe: remember,
              firebaseToken: null,
              idToken: null,
              isFirebaseAuthenticated: false,
            });
          }
        } else {
          // Login sem Firebase Auth
          set({
            user,
            token,
            keyPair,
            isAuthenticated: true,
            isLoading: false,
            rememberMe: remember,
            firebaseToken: null,
            idToken: null,
            isFirebaseAuthenticated: false,
          });
        }
      },

      logout: async () => {
        // Fazer logout do Firebase Auth
        if (typeof window !== 'undefined') {
          try {
            const { getFirebaseAuthManager } = await import('@/lib/db/firebase-client');
            const authManager = getFirebaseAuthManager();
            await authManager.signOut();
          } catch (error) {
            console.error('[AuthStore] Erro ao fazer logout do Firebase:', error);
          }
          
          // Limpar ambos os storages
          localStorage.removeItem('auth-storage');
          sessionStorage.removeItem('auth-storage');
        }
        
        set({
          user: null,
          token: null,
          secretKey: null,
          keyPair: null,
          isAuthenticated: false,
          isLoading: false,
          rememberMe: true,
          firebaseToken: null,
          idToken: null,
          isFirebaseAuthenticated: false,
        });
      },
      
      getValidIdToken: async () => {
        if (typeof window === 'undefined') return null;
        
        try {
          const { getFirebaseAuthManager } = await import('@/lib/db/firebase-client');
          const authManager = getFirebaseAuthManager();
          const validToken = await authManager.getValidToken();
          
          if (validToken) {
            set({ idToken: validToken });
          }
          
          return validToken;
        } catch (error) {
          console.error('[AuthStore] Erro ao obter ID Token válido:', error);
          return null;
        }
      },

      rehydrateAuth: async () => {
        const { token, keyPair, user, firebaseToken } = get();
        
        // Se já tem usuário, não precisa fazer nada
        if (user) {
          // Tentar re-autenticar com Firebase se temos firebaseToken
          if (firebaseToken && typeof window !== 'undefined') {
            try {
              const { getFirebaseAuthManager } = await import('@/lib/db/firebase-client');
              const authManager = getFirebaseAuthManager();
              
              // Verificar se já está autenticado
              if (!authManager.isAuthenticated()) {
                const idToken = await authManager.signInWithCustomToken(firebaseToken);
                set({ idToken, isFirebaseAuthenticated: true });
              } else {
                const idToken = authManager.getCurrentToken();
                set({ idToken, isFirebaseAuthenticated: true });
              }
            } catch (error) {
              console.error('[AuthStore] Erro ao re-autenticar com Firebase:', error);
              set({ isFirebaseAuthenticated: false });
            }
          }
          
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
            firebaseToken: null,
            idToken: null,
            isFirebaseAuthenticated: false,
          });
        } catch (error) {
          console.error('Erro ao rehydratar autenticação:', error);
          set({
            user: null,
            token: null,
            keyPair: null,
            isAuthenticated: false,
            isLoading: false,
            firebaseToken: null,
            idToken: null,
            isFirebaseAuthenticated: false,
          });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => createCustomStorage()),
      partialize: (state) => ({
        token: state.token,
        keyPair: state.keyPair,
        user: state.user,
        rememberMe: state.rememberMe,
        firebaseToken: state.firebaseToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
          // Se tem user persistido, marcar como autenticado
          if (state.user && state.token && state.keyPair) {
            state.setUser(state.user);
            state.setLoading(false);
            // Tentar re-autenticar com Firebase
            if (state.firebaseToken) {
              state.rehydrateAuth();
            }
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
