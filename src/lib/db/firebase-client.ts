import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, signInWithCustomToken, onIdTokenChanged, User, signOut } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';

// Configuração do Firebase Client
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Singleton para o app Firebase
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let realtimeDb: Database | null = null;

// Inicializar Firebase Client
function initializeFirebaseClient(): FirebaseApp {
  if (app) return app;
  
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  
  return app;
}

// Obter instância do Auth
export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  
  const firebaseApp = initializeFirebaseClient();
  auth = getAuth(firebaseApp);
  
  return auth;
}

// Obter instância do Realtime Database
export function getRealtimeDatabase(): Database {
  if (realtimeDb) return realtimeDb;
  
  const firebaseApp = initializeFirebaseClient();
  realtimeDb = getDatabase(firebaseApp);
  
  return realtimeDb;
}

// Tipos para callbacks
type TokenChangeCallback = (token: string | null) => void;
type UnsubscribeFunction = () => void;

// Classe para gerenciar autenticação Firebase
export class FirebaseAuthManager {
  private auth: Auth;
  private currentUser: User | null = null;
  private idToken: string | null = null;
  private tokenRefreshTimeout: NodeJS.Timeout | null = null;
  private tokenChangeListeners: Set<TokenChangeCallback> = new Set();
  private unsubscribeIdToken: UnsubscribeFunction | null = null;

  constructor() {
    this.auth = getFirebaseAuth();
    this.setupIdTokenListener();
  }

  // Configurar listener para mudanças no ID Token
  private setupIdTokenListener(): void {
    this.unsubscribeIdToken = onIdTokenChanged(this.auth, async (user) => {
      this.currentUser = user;
      
      if (user) {
        // Obter novo ID Token
        try {
          this.idToken = await user.getIdToken();
          this.notifyTokenChange(this.idToken);
          this.scheduleTokenRefresh(user);
        } catch (error) {
          console.error('[FirebaseAuth] Erro ao obter ID Token:', error);
          this.idToken = null;
          this.notifyTokenChange(null);
        }
      } else {
        this.idToken = null;
        this.notifyTokenChange(null);
        this.clearTokenRefresh();
      }
    });
  }

  // Agendar refresh do token antes de expirar (5 minutos antes)
  private scheduleTokenRefresh(user: User): void {
    this.clearTokenRefresh();
    
    // ID Token expira em 1 hora, refresh 5 minutos antes
    const REFRESH_INTERVAL = 55 * 60 * 1000; // 55 minutos
    
    this.tokenRefreshTimeout = setTimeout(async () => {
      try {
        console.log('[FirebaseAuth] Renovando ID Token proativamente...');
        const newToken = await user.getIdToken(true); // força refresh
        this.idToken = newToken;
        this.notifyTokenChange(newToken);
        this.scheduleTokenRefresh(user);
      } catch (error) {
        console.error('[FirebaseAuth] Erro ao renovar token:', error);
        this.notifyTokenChange(null);
      }
    }, REFRESH_INTERVAL);
  }

  // Limpar timeout de refresh
  private clearTokenRefresh(): void {
    if (this.tokenRefreshTimeout) {
      clearTimeout(this.tokenRefreshTimeout);
      this.tokenRefreshTimeout = null;
    }
  }

  // Notificar listeners sobre mudança no token
  private notifyTokenChange(token: string | null): void {
    this.tokenChangeListeners.forEach((callback) => callback(token));
  }

  // Autenticar com Custom Token
  async signInWithCustomToken(customToken: string): Promise<string> {
    try {
      const userCredential = await signInWithCustomToken(this.auth, customToken);
      this.currentUser = userCredential.user;
      this.idToken = await userCredential.user.getIdToken();
      return this.idToken;
    } catch (error) {
      console.error('[FirebaseAuth] Erro ao autenticar com Custom Token:', error);
      throw error;
    }
  }

  // Obter ID Token válido (com refresh se necessário)
  async getValidToken(forceRefresh = false): Promise<string | null> {
    if (!this.currentUser) {
      return null;
    }

    try {
      // Se forceRefresh ou se token está próximo de expirar
      if (forceRefresh) {
        this.idToken = await this.currentUser.getIdToken(true);
        return this.idToken;
      }

      // Verificar se token precisa de refresh (usando metadata do token)
      const tokenResult = await this.currentUser.getIdTokenResult();
      const expirationTime = new Date(tokenResult.expirationTime).getTime();
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (expirationTime - now < fiveMinutes) {
        console.log('[FirebaseAuth] Token expirando em breve, renovando...');
        this.idToken = await this.currentUser.getIdToken(true);
      }

      return this.idToken;
    } catch (error) {
      console.error('[FirebaseAuth] Erro ao obter token válido:', error);
      return null;
    }
  }

  // Obter token atual sem refresh
  getCurrentToken(): string | null {
    return this.idToken;
  }

  // Obter usuário atual
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Verificar se está autenticado
  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  // Adicionar listener para mudanças no token
  onTokenChange(callback: TokenChangeCallback): UnsubscribeFunction {
    this.tokenChangeListeners.add(callback);
    
    // Chamar imediatamente com o token atual
    if (this.idToken) {
      callback(this.idToken);
    }

    return () => {
      this.tokenChangeListeners.delete(callback);
    };
  }

  // Fazer logout
  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      this.currentUser = null;
      this.idToken = null;
      this.clearTokenRefresh();
    } catch (error) {
      console.error('[FirebaseAuth] Erro ao fazer logout:', error);
      throw error;
    }
  }

  // Limpar recursos
  destroy(): void {
    this.clearTokenRefresh();
    if (this.unsubscribeIdToken) {
      this.unsubscribeIdToken();
    }
    this.tokenChangeListeners.clear();
  }
}

// Singleton do AuthManager
let authManager: FirebaseAuthManager | null = null;

export function getFirebaseAuthManager(): FirebaseAuthManager {
  if (typeof window === 'undefined') {
    throw new Error('FirebaseAuthManager só pode ser usado no cliente');
  }
  
  if (!authManager) {
    authManager = new FirebaseAuthManager();
  }
  
  return authManager;
}

// Exportar tipos úteis
export type { User, Auth, Database };
