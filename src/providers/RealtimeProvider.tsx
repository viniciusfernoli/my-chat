'use client';

import { createContext, useContext, useEffect, useRef, useCallback, ReactNode, useState } from 'react';
import { 
  ref, 
  set, 
  push, 
  onValue, 
  onChildAdded, 
  onChildChanged,
  onChildRemoved,
  serverTimestamp,
  remove,
  query,
  orderByChild,
  limitToLast,
  DatabaseReference,
  Unsubscribe,
  DataSnapshot,
  off
} from 'firebase/database';
import { getRealtimeDatabase } from '@/lib/db/firebase-client';
import { getPresenceService, PresenceService, UserStatus, PresenceData } from '@/services/presence-service';
import { useAuthStore, useChatStore } from '@/stores';
import { IMessage, IConversation, IUser } from '@/types';
import { notificationService } from '@/services/notification-service';

// Interface mantida compatível com SocketProvider
interface RealtimeContextType {
  isConnected: boolean;
  isReconnecting: boolean;
  joinConversation: (conversationId: string, participantIds?: string[]) => void;
  leaveConversation: (conversationId: string) => void;
  sendMessage: (conversationId: string, message: IMessage, participantIds: string[]) => void;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  reactToMessage: (conversationId: string, messageId: string, emoji: string) => void;
  notifyNewConversation: (conversation: IConversation, participantIds: string[]) => void;
  notifyGroupUpdate: (conversationId: string, update: Partial<IConversation>, participantIds: string[]) => void;
  notifyMemberAdded: (conversationId: string, member: IUser) => void;
  notifyMemberRemoved: (conversationId: string, memberId: string) => void;
  updateUserStatus: (status: string) => void;
}

const RealtimeContext = createContext<RealtimeContextType | null>(null);

// Estruturas de dados do Realtime Database
interface TypingData {
  isTyping: boolean;
  timestamp: number | object;
  nickname: string;
  userId: string;
}

interface NotificationData {
  type: 'new_conversation' | 'member_added' | 'member_removed' | 'group_update' | 'new_message';
  conversationId: string;
  data: Record<string, unknown>;
  senderId: string;
  timestamp: number | object;
  read: boolean;
}

interface MessageNotification {
  conversationId: string;
  message: IMessage;
  timestamp: number | object;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  const database = getRealtimeDatabase();
  const presenceServiceRef = useRef<PresenceService | null>(null);
  const activeConversationRef = useRef<string | null>(null);
  const listenersRef = useRef<Map<string, Unsubscribe>>(new Map());
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const processedMessagesRef = useRef<Set<string>>(new Set());
  const firebaseAuthAttemptedRef = useRef(false);
  
  const { user, isFirebaseAuthenticated, setFirebaseAuthenticated, setIdToken, setFirebaseToken } = useAuthStore();
  const chatStoreRef = useRef(useChatStore.getState());
  
  // Manter ref atualizada do chat store
  useEffect(() => {
    return useChatStore.subscribe((state) => {
      chatStoreRef.current = state;
    });
  }, []);

  const {
    setOnlineUsers,
    removeOnlineUser,
    addMessage,
    addTypingUser,
    removeTypingUser,
    updateMessage,
    addConversation,
    updateConversation,
    removeConversation,
    moveConversationToTop,
    incrementUnreadCount,
    setUserStatus,
  } = useChatStore();

  // Tentar obter Firebase Token se usuário está logado mas não autenticado no Firebase
  useEffect(() => {
    if (!user || isFirebaseAuthenticated || firebaseAuthAttemptedRef.current) return;
    
    firebaseAuthAttemptedRef.current = true;
    
    const authenticateWithFirebase = async () => {
      try {
        console.log('[RealtimeProvider] Usuário logado mas não autenticado no Firebase. Obtendo token...');
        
        // Obter novo Firebase Token via API
        const res = await fetch('/api/auth/firebase-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        });
        
        if (!res.ok) {
          throw new Error('Falha ao obter Firebase Token');
        }
        
        const { firebaseToken } = await res.json();
        
        if (firebaseToken) {
          // Autenticar no Firebase
          const { getFirebaseAuthManager } = await import('@/lib/db/firebase-client');
          const authManager = getFirebaseAuthManager();
          const idToken = await authManager.signInWithCustomToken(firebaseToken);
          
          // Atualizar store
          setFirebaseToken(firebaseToken);
          setIdToken(idToken);
          setFirebaseAuthenticated(true);
          
          console.log('[RealtimeProvider] ✅ Autenticado no Firebase com sucesso!');
        }
      } catch (error) {
        console.error('[RealtimeProvider] Erro ao autenticar no Firebase:', error);
        // Reset para tentar novamente no próximo reload
        firebaseAuthAttemptedRef.current = false;
      }
    };
    
    authenticateWithFirebase();
  }, [user, isFirebaseAuthenticated, setFirebaseAuthenticated, setIdToken, setFirebaseToken]);

  // Inicializar serviço de presença quando autenticado
  useEffect(() => {
    if (!user || !isFirebaseAuthenticated) return;

    const initializePresence = async () => {
      try {
        presenceServiceRef.current = getPresenceService();
        
        // Configurar listener de conexão
        presenceServiceRef.current.onConnectionChange((connected) => {
          setIsConnected(connected);
          setIsReconnecting(!connected);
          
          if (connected) {
            console.log('✅ Conectado ao Firebase Realtime Database');
          } else {
            console.log('⚠️ Desconectado do Firebase - Tentando reconectar...');
          }
        });

        // Inicializar presença
        await presenceServiceRef.current.initialize(user.id, user.nickname, user.avatar);
        
        // Aguardar um momento para garantir que a presença foi salva
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Observar presença de todos os usuários
        console.log('[RealtimeProvider] Configurando watchAllUsers...');
        presenceServiceRef.current.watchAllUsers((userId, presence) => {
          console.log(`[RealtimeProvider] Presença recebida - userId: ${userId}, online: ${presence?.online}, status: ${presence?.status}`);
          if (userId !== user.id && presence) {
            if (presence.online) {
              console.log(`[RealtimeProvider] Marcando ${userId} como ONLINE`);
              setOnlineUsers([userId]);
              setUserStatus(userId, presence.status || 'online');
            } else {
              console.log(`[RealtimeProvider] Marcando ${userId} como OFFLINE`);
              removeOnlineUser(userId);
              setUserStatus(userId, 'offline');
            }
          }
        });

        console.log('[RealtimeProvider] Presença inicializada');
      } catch (error) {
        console.error('[RealtimeProvider] Erro ao inicializar presença:', error);
      }
    };

    initializePresence();

    return () => {
      if (presenceServiceRef.current) {
        presenceServiceRef.current.goOffline();
        presenceServiceRef.current.destroy();
        presenceServiceRef.current = null;
      }
    };
  }, [user, isFirebaseAuthenticated, setOnlineUsers, removeOnlineUser, setUserStatus]);

  // Listener para notificações do usuário
  useEffect(() => {
    if (!user || !isFirebaseAuthenticated) return;

    const notificationsRef = ref(database, `notifications/${user.id}`);
    
    const unsubscribe = onChildAdded(notificationsRef, async (snapshot: DataSnapshot) => {
      const notificationId = snapshot.key;
      const notification = snapshot.val() as NotificationData;
      
      if (!notification || notification.read) return;
      
      console.log('🔔 Nova notificação:', notification.type);

      switch (notification.type) {
        case 'new_conversation':
          const convData = notification.data as { conversation: IConversation };
          if (convData.conversation) {
            addConversation(convData.conversation);
          }
          break;

        case 'new_message':
          const msgNotification = notification as unknown as MessageNotification;
          const { conversationId, message } = msgNotification;
          
          // Evitar processar mensagens duplicadas
          if (processedMessagesRef.current.has(message.id)) return;
          processedMessagesRef.current.add(message.id);
          
          // Limpar mensagens antigas do set (manter últimas 1000)
          if (processedMessagesRef.current.size > 1000) {
            const arr = Array.from(processedMessagesRef.current);
            processedMessagesRef.current = new Set(arr.slice(-500));
          }
          
          // Não adicionar se foi eu que enviei
          if (message.senderId !== user.id) {
            addMessage(conversationId, message);
            moveConversationToTop(conversationId);
            
            const currentConv = chatStoreRef.current.currentConversation;
            
            if (currentConv?.id !== conversationId) {
              incrementUnreadCount(conversationId);
            }
            
            // Enviar notificação push
            const userStatus = user.status || 'online';
            if (notificationService.shouldNotify(userStatus, currentConv?.id, conversationId)) {
              const senderName = message.sender?.nickname || 'Alguém';
              const messageContent = message.type === 'gif' 
                ? '🎬 Enviou um GIF' 
                : message.type === 'image'
                ? '📷 Enviou uma imagem'
                : message.content || 'Nova mensagem';
              
              notificationService.notifyNewMessage(
                senderName,
                messageContent,
                conversationId,
                message.sender?.avatar
              );
            }
          }
          break;

        case 'member_added':
          const addedData = notification.data as { conversationId: string };
          try {
            const res = await fetch(`/api/conversations/${addedData.conversationId}`, {
              headers: { 'x-user-id': user.id },
            });
            if (res.ok) {
              const conversation = await res.json();
              addConversation(conversation);
            }
          } catch (error) {
            console.error('Erro ao carregar conversa:', error);
          }
          break;

        case 'member_removed':
          const removedData = notification.data as { conversationId: string };
          removeConversation(removedData.conversationId);
          break;

        case 'group_update':
          const updateData = notification.data as { conversationId: string; update: Partial<IConversation> };
          updateConversation(updateData.conversationId, updateData.update);
          break;
      }

      // Marcar notificação como lida
      if (notificationId) {
        await set(ref(database, `notifications/${user.id}/${notificationId}/read`), true);
      }
    });

    return () => unsubscribe();
  }, [user, isFirebaseAuthenticated, database, addConversation, addMessage, updateConversation, removeConversation, moveConversationToTop, incrementUnreadCount]);

  // Registrar Service Worker
  useEffect(() => {
    if (user) {
      notificationService.registerServiceWorker();
    }
  }, [user]);

  // Entrar em uma conversa - ouvir typing e mensagens
  const joinConversation = useCallback((conversationId: string, participantIds?: string[]) => {
    if (!user || !isFirebaseAuthenticated) return;
    
    console.log('🚪 Entrando na conversa:', conversationId);
    activeConversationRef.current = conversationId;

    // Listener para typing desta conversa usando onChildAdded/onChildChanged/onChildRemoved
    const typingRef = ref(database, `typing/${conversationId}`);
    
    // Quando alguém começa ou atualiza o typing
    const typingAddedUnsubscribe = onChildAdded(typingRef, (snapshot: DataSnapshot) => {
      const typingUserId = snapshot.key;
      const data = snapshot.val() as TypingData;
      
      if (typingUserId && typingUserId !== user.id && data && data.isTyping) {
        addTypingUser(conversationId, typingUserId);
      }
    });
    
    const typingChangedUnsubscribe = onChildChanged(typingRef, (snapshot: DataSnapshot) => {
      const typingUserId = snapshot.key;
      const data = snapshot.val() as TypingData;
      
      if (typingUserId && typingUserId !== user.id && data) {
        if (data.isTyping) {
          addTypingUser(conversationId, typingUserId);
        } else {
          removeTypingUser(conversationId, typingUserId);
        }
      }
    });
    
    // Quando alguém remove seu typing (ex: fechou a aba)
    const typingRemovedUnsubscribe = onChildRemoved(typingRef, (snapshot: DataSnapshot) => {
      const typingUserId = snapshot.key;
      if (typingUserId && typingUserId !== user.id) {
        removeTypingUser(conversationId, typingUserId);
      }
    });

    // Guardar todos os unsubscribers
    listenersRef.current.set(`typing_added_${conversationId}`, typingAddedUnsubscribe);
    listenersRef.current.set(`typing_changed_${conversationId}`, typingChangedUnsubscribe);
    listenersRef.current.set(`typing_removed_${conversationId}`, typingRemovedUnsubscribe);

    // Registrar que estamos nesta conversa (para controle de acesso se necessário)
    set(ref(database, `conversationMembers/${conversationId}/${user.id}`), true);
    
  }, [user, isFirebaseAuthenticated, database, addTypingUser, removeTypingUser]);

  // Sair de uma conversa
  const leaveConversation = useCallback((conversationId: string) => {
    console.log('🚶 Saindo da conversa:', conversationId);
    
    // Remover listeners de typing
    ['typing_added_', 'typing_changed_', 'typing_removed_'].forEach(prefix => {
      const key = `${prefix}${conversationId}`;
      const unsubscribe = listenersRef.current.get(key);
      if (unsubscribe) {
        unsubscribe();
        listenersRef.current.delete(key);
      }
    });

    // Parar de digitar se estava
    if (user) {
      const myTypingRef = ref(database, `typing/${conversationId}/${user.id}`);
      remove(myTypingRef);
    }

    activeConversationRef.current = null;
  }, [user, database]);

  // Função auxiliar para remover valores undefined (Firebase não aceita undefined)
  const cleanUndefined = (obj: Record<string, unknown>): Record<string, unknown> => {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          cleaned[key] = cleanUndefined(value as Record<string, unknown>);
        } else {
          cleaned[key] = value;
        }
      }
    }
    return cleaned;
  };

  // Enviar mensagem
  const sendMessage = useCallback(async (conversationId: string, message: IMessage, participantIds: string[]) => {
    if (!user || !isFirebaseAuthenticated) return;
    
    console.log('📤 Enviando notificação de mensagem');

    // Limpar valores undefined do message (Firebase não aceita undefined)
    const cleanedMessage = cleanUndefined(message as unknown as Record<string, unknown>);

    // Notificar todos os participantes (exceto eu)
    for (const participantId of participantIds) {
      if (participantId !== user.id) {
        const notificationRef = push(ref(database, `notifications/${participantId}`));
        await set(notificationRef, {
          type: 'new_message',
          conversationId,
          message: cleanedMessage,
          senderId: user.id,
          timestamp: serverTimestamp(),
          read: false,
        });
      }
    }

    // Parar typing indicator
    stopTyping(conversationId);
  }, [user, isFirebaseAuthenticated, database]);

  // Indicar que está digitando
  const startTyping = useCallback((conversationId: string) => {
    if (!user || !isFirebaseAuthenticated) return;

    const typingRef = ref(database, `typing/${conversationId}/${user.id}`);
    
    set(typingRef, {
      isTyping: true,
      timestamp: serverTimestamp(),
      nickname: user.nickname,
      userId: user.id,
    });

    // Limpar timeout anterior
    const existingTimeout = typingTimeoutsRef.current.get(conversationId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Auto-remover após 5 segundos
    const timeout = setTimeout(() => {
      set(typingRef, {
        isTyping: false,
        timestamp: serverTimestamp(),
        nickname: user.nickname,
        userId: user.id,
      });
      typingTimeoutsRef.current.delete(conversationId);
    }, 5000);

    typingTimeoutsRef.current.set(conversationId, timeout);
  }, [user, isFirebaseAuthenticated, database]);

  // Parar de digitar
  const stopTyping = useCallback((conversationId: string) => {
    if (!user || !isFirebaseAuthenticated) return;

    // Limpar timeout
    const existingTimeout = typingTimeoutsRef.current.get(conversationId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      typingTimeoutsRef.current.delete(conversationId);
    }

    const typingRef = ref(database, `typing/${conversationId}/${user.id}`);
    remove(typingRef);
  }, [user, isFirebaseAuthenticated, database]);

  // Reagir a mensagem (continua usando API, mas notifica via Realtime)
  const reactToMessage = useCallback(async (conversationId: string, messageId: string, emoji: string) => {
    if (!user || !isFirebaseAuthenticated) return;

    // A reação é salva via API, aqui apenas notificamos os participantes
    // Isso será tratado pela própria API que faz o update no Firestore
    console.log('👍 Reação registrada:', emoji);
  }, [user, isFirebaseAuthenticated]);

  // Notificar nova conversa
  const notifyNewConversation = useCallback(async (conversation: IConversation, participantIds: string[]) => {
    if (!user || !isFirebaseAuthenticated) return;
    
    console.log('📢 Notificando nova conversa:', conversation.id);

    for (const participantId of participantIds) {
      if (participantId !== user.id) {
        const notificationRef = push(ref(database, `notifications/${participantId}`));
        await set(notificationRef, {
          type: 'new_conversation',
          conversationId: conversation.id,
          data: { conversation },
          senderId: user.id,
          timestamp: serverTimestamp(),
          read: false,
        });
      }
    }

    // Registrar membros da conversa
    for (const participantId of participantIds) {
      await set(ref(database, `conversationMembers/${conversation.id}/${participantId}`), true);
    }
  }, [user, isFirebaseAuthenticated, database]);

  // Notificar atualização de grupo
  const notifyGroupUpdate = useCallback(async (conversationId: string, update: Partial<IConversation>, participantIds: string[]) => {
    if (!user || !isFirebaseAuthenticated) return;
    
    console.log('📝 Notificando atualização do grupo:', conversationId);

    for (const participantId of participantIds) {
      if (participantId !== user.id) {
        const notificationRef = push(ref(database, `notifications/${participantId}`));
        await set(notificationRef, {
          type: 'group_update',
          conversationId,
          data: { conversationId, update },
          senderId: user.id,
          timestamp: serverTimestamp(),
          read: false,
        });
      }
    }
  }, [user, isFirebaseAuthenticated, database]);

  // Notificar membro adicionado
  const notifyMemberAdded = useCallback(async (conversationId: string, member: IUser) => {
    if (!user || !isFirebaseAuthenticated) return;
    
    console.log('➕ Notificando membro adicionado:', member.id);

    // Notificar o membro que foi adicionado
    const notificationRef = push(ref(database, `notifications/${member.id}`));
    await set(notificationRef, {
      type: 'member_added',
      conversationId,
      data: { conversationId },
      senderId: user.id,
      timestamp: serverTimestamp(),
      read: false,
    });

    // Adicionar membro à lista de membros da conversa
    await set(ref(database, `conversationMembers/${conversationId}/${member.id}`), true);
  }, [user, isFirebaseAuthenticated, database]);

  // Notificar membro removido
  const notifyMemberRemoved = useCallback(async (conversationId: string, memberId: string) => {
    if (!user || !isFirebaseAuthenticated) return;
    
    console.log('➖ Notificando membro removido:', memberId);

    // Notificar o membro que foi removido
    const notificationRef = push(ref(database, `notifications/${memberId}`));
    await set(notificationRef, {
      type: 'member_removed',
      conversationId,
      data: { conversationId },
      senderId: user.id,
      timestamp: serverTimestamp(),
      read: false,
    });

    // Remover membro da lista de membros da conversa
    await remove(ref(database, `conversationMembers/${conversationId}/${memberId}`));
  }, [user, isFirebaseAuthenticated, database]);

  // Atualizar status do usuário
  const updateUserStatus = useCallback(async (status: string) => {
    if (!user || !isFirebaseAuthenticated || !presenceServiceRef.current) return;
    
    console.log('📊 Atualizando status para:', status);
    await presenceServiceRef.current.updateStatus(status as UserStatus);
  }, [user, isFirebaseAuthenticated]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      // Limpar todos os listeners
      listenersRef.current.forEach((unsubscribe) => unsubscribe());
      listenersRef.current.clear();

      // Limpar timeouts de typing
      typingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeoutsRef.current.clear();
    };
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        isConnected,
        isReconnecting,
        joinConversation,
        leaveConversation,
        sendMessage,
        startTyping,
        stopTyping,
        reactToMessage,
        notifyNewConversation,
        notifyGroupUpdate,
        notifyMemberAdded,
        notifyMemberRemoved,
        updateUserStatus,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

// Hook para usar o contexto - mantém nome useSocket para compatibilidade
export function useSocket() {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useSocket deve ser usado dentro de um RealtimeProvider');
  }
  return context;
}

// Alias para o novo nome
export const useRealtime = useSocket;
