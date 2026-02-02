import { 
  ref, 
  set, 
  onValue, 
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onDisconnect, 
  serverTimestamp,
  push,
  remove,
  DataSnapshot,
  Unsubscribe,
  DatabaseReference
} from 'firebase/database';
import { getRealtimeDatabase } from '@/lib/db/firebase-client';

export type UserStatus = 'online' | 'offline' | 'away' | 'busy';

export interface PresenceData {
  online: boolean;
  status: UserStatus;
  lastSeen: number | object; // serverTimestamp() returns object
  nickname?: string;
  avatar?: string;
}

export interface UserPresence extends PresenceData {
  connections?: Record<string, boolean>;
}

type PresenceChangeCallback = (userId: string, presence: PresenceData | null) => void;
type ConnectionChangeCallback = (isConnected: boolean) => void;

/**
 * Serviço de presença usando Firebase Realtime Database.
 * Gerencia status online/offline com suporte a múltiplas conexões (tabs/dispositivos).
 */
export class PresenceService {
  private database = getRealtimeDatabase();
  private userId: string | null = null;
  private connectionId: string | null = null;
  private userPresenceRef: DatabaseReference | null = null;
  private connectionRef: DatabaseReference | null = null;
  private connectedRef: DatabaseReference;
  
  private presenceListeners: Map<string, Unsubscribe> = new Map();
  private allPresenceListener: Unsubscribe | null = null;
  private connectionListener: Unsubscribe | null = null;
  
  private presenceCallbacks: Set<PresenceChangeCallback> = new Set();
  private connectionCallbacks: Set<ConnectionChangeCallback> = new Set();
  
  private isConnected = false;
  private currentStatus: UserStatus = 'online';

  constructor() {
    // Referência especial para monitorar conexão com o Firebase
    this.connectedRef = ref(this.database, '.info/connected');
  }

  /**
   * Inicializa a presença do usuário.
   * Deve ser chamado após autenticação Firebase.
   */
  async initialize(userId: string, nickname?: string, avatar?: string): Promise<void> {
    if (this.userId === userId) {
      console.log('[PresenceService] Já inicializado para este usuário');
      return;
    }

    this.userId = userId;
    this.userPresenceRef = ref(this.database, `presence/${userId}`);
    
    // Gerar ID único para esta conexão (tab/dispositivo)
    const connectionsRef = ref(this.database, `presence/${userId}/connections`);
    const newConnectionRef = push(connectionsRef);
    this.connectionId = newConnectionRef.key;
    this.connectionRef = newConnectionRef;

    // Monitorar estado da conexão com o Firebase
    this.connectionListener = onValue(this.connectedRef, async (snapshot) => {
      this.isConnected = snapshot.val() === true;
      this.notifyConnectionChange(this.isConnected);

      if (this.isConnected && this.userPresenceRef && this.connectionRef) {
        console.log('[PresenceService] Conectado ao Firebase Realtime Database');
        
        // Configurar onDisconnect ANTES de escrever presença
        // Isso garante que mesmo se a conexão cair abruptamente, o status será atualizado
        const disconnectData: Partial<PresenceData> = {
          online: false,
          status: 'offline',
          lastSeen: serverTimestamp(),
        };
        
        await onDisconnect(this.userPresenceRef).update(disconnectData);
        await onDisconnect(this.connectionRef).remove();

        // Marcar como online (não enviar campos undefined)
        const presenceData: Record<string, unknown> = {
          online: true,
          status: this.currentStatus,
          lastSeen: serverTimestamp(),
          connections: { [this.connectionId!]: true },
        };
        
        // Adicionar nickname e avatar apenas se existirem
        if (nickname) presenceData.nickname = nickname;
        if (avatar) presenceData.avatar = avatar;

        await set(this.userPresenceRef, presenceData);

        console.log('[PresenceService] Presença configurada com sucesso');
      } else {
        console.log('[PresenceService] Desconectado do Firebase');
      }
    });
  }

  /**
   * Atualiza o status do usuário (online, away, busy, offline).
   */
  async updateStatus(status: UserStatus): Promise<void> {
    if (!this.userPresenceRef || !this.userId) {
      console.warn('[PresenceService] Não inicializado. Chame initialize() primeiro.');
      return;
    }

    this.currentStatus = status;

    const updates: Partial<PresenceData> = {
      status,
      lastSeen: serverTimestamp(),
    };

    // Se definir como offline, também marcar online: false
    if (status === 'offline') {
      updates.online = false;
    } else {
      updates.online = true;
    }

    await set(this.userPresenceRef, {
      ...updates,
      connections: this.connectionId ? { [this.connectionId]: true } : {},
    });
    
    console.log(`[PresenceService] Status atualizado para: ${status}`);
  }

  /**
   * Marca o usuário como online.
   */
  async goOnline(): Promise<void> {
    await this.updateStatus('online');
  }

  /**
   * Marca o usuário como offline.
   */
  async goOffline(): Promise<void> {
    if (!this.userPresenceRef) return;

    await set(this.userPresenceRef, {
      online: false,
      status: 'offline',
      lastSeen: serverTimestamp(),
    });
    
    // Remover esta conexão
    if (this.connectionRef) {
      await remove(this.connectionRef);
    }
  }

  /**
   * Observa a presença de um usuário específico.
   */
  watchUser(userId: string, callback: (presence: PresenceData | null) => void): Unsubscribe {
    const userRef = ref(this.database, `presence/${userId}`);
    
    const unsubscribe = onValue(userRef, (snapshot: DataSnapshot) => {
      const data = snapshot.val() as UserPresence | null;
      
      if (data) {
        callback({
          online: data.online,
          status: data.status,
          lastSeen: data.lastSeen,
          nickname: data.nickname,
          avatar: data.avatar,
        });
      } else {
        callback(null);
      }
    });

    this.presenceListeners.set(userId, unsubscribe);
    return unsubscribe;
  }

  /**
   * Para de observar um usuário específico.
   */
  unwatchUser(userId: string): void {
    const unsubscribe = this.presenceListeners.get(userId);
    if (unsubscribe) {
      unsubscribe();
      this.presenceListeners.delete(userId);
    }
  }

  /**
   * Observa a presença de todos os usuários.
   * Usa onChildAdded e onChildChanged para detectar novos usuários e mudanças.
   */
  watchAllUsers(callback: PresenceChangeCallback): Unsubscribe {
    const allPresenceRef = ref(this.database, 'presence');
    
    console.log('[PresenceService] Iniciando watchAllUsers no path: presence');
    
    // Processar dados de presença
    const processPresence = (snapshot: DataSnapshot) => {
      const userId = snapshot.key;
      const data = snapshot.val() as UserPresence;
      
      console.log(`[PresenceService] onChild callback - userId: ${userId}, data:`, data);
      
      if (userId && data) {
        console.log(`[PresenceService] Presença de ${userId}:`, data.online ? 'online' : 'offline', data.status);
        callback(userId, {
          online: data.online,
          status: data.status || 'online',
          lastSeen: data.lastSeen,
          nickname: data.nickname,
          avatar: data.avatar,
        });
      }
    };
    
    // Listener para usuários existentes e novos
    const addedListener = onChildAdded(allPresenceRef, processPresence, (error) => {
      console.error('[PresenceService] Erro no onChildAdded:', error);
    });
    
    // Listener para mudanças de status
    const changedListener = onChildChanged(allPresenceRef, processPresence, (error) => {
      console.error('[PresenceService] Erro no onChildChanged:', error);
    });
    
    // Listener para quando um usuário é removido
    const removedListener = onChildRemoved(allPresenceRef, (snapshot: DataSnapshot) => {
      const userId = snapshot.key;
      if (userId) {
        console.log(`[PresenceService] Presença removida de ${userId}`);
        callback(userId, {
          online: false,
          status: 'offline',
          lastSeen: Date.now(),
        });
      }
    }, (error) => {
      console.error('[PresenceService] Erro no onChildRemoved:', error);
    });

    this.presenceCallbacks.add(callback);
    
    return () => {
      this.presenceCallbacks.delete(callback);
      if (this.presenceCallbacks.size === 0) {
        addedListener();
        changedListener();
        removedListener();
      }
    };
  }

  /**
   * Adiciona callback para mudanças no estado de conexão.
   */
  onConnectionChange(callback: ConnectionChangeCallback): Unsubscribe {
    this.connectionCallbacks.add(callback);
    
    // Chamar imediatamente com o estado atual
    callback(this.isConnected);
    
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

  /**
   * Retorna se está conectado ao Firebase.
   */
  getConnectionState(): boolean {
    return this.isConnected;
  }

  /**
   * Retorna o ID do usuário atual.
   */
  getCurrentUserId(): string | null {
    return this.userId;
  }

  /**
   * Limpa todos os listeners e recursos.
   */
  destroy(): void {
    // Parar todos os listeners de usuários específicos
    this.presenceListeners.forEach((unsubscribe) => unsubscribe());
    this.presenceListeners.clear();

    // Parar listener de todos os usuários
    if (this.allPresenceListener) {
      this.allPresenceListener();
      this.allPresenceListener = null;
    }

    // Parar listener de conexão
    if (this.connectionListener) {
      this.connectionListener();
      this.connectionListener = null;
    }

    // Limpar callbacks
    this.presenceCallbacks.clear();
    this.connectionCallbacks.clear();

    // Reset state
    this.userId = null;
    this.connectionId = null;
    this.userPresenceRef = null;
    this.connectionRef = null;
  }

  private notifyConnectionChange(isConnected: boolean): void {
    this.connectionCallbacks.forEach((callback) => callback(isConnected));
  }
}

// Singleton
let presenceService: PresenceService | null = null;

export function getPresenceService(): PresenceService {
  if (typeof window === 'undefined') {
    throw new Error('PresenceService só pode ser usado no cliente');
  }
  
  if (!presenceService) {
    presenceService = new PresenceService();
  }
  
  return presenceService;
}
