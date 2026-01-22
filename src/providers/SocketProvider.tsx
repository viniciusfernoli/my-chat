'use client';

import { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore, useChatStore } from '@/stores';
import { IMessage, IConversation, IUser } from '@/types';
import { notificationService } from '@/services/notification-service';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinConversation: (conversationId: string) => void;
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

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const { user } = useAuthStore();
  const chatStoreRef = useRef(useChatStore.getState());
  
  // Manter ref atualizada
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

  // Conectar ao socket quando usuário estiver autenticado
  useEffect(() => {
    if (!user || socketRef.current?.connected) return;

    // URL do WebSocket - usar variável de ambiente ou mesmo host com porta diferente
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 
      (typeof window !== 'undefined' 
        ? `${window.location.protocol}//${window.location.hostname}:3001`
        : 'http://localhost:3001');

    console.log('Conectando ao socket:', socketUrl);

    socketRef.current = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('✅ Socket conectado:', socket.id);
      isConnectedRef.current = true;

      // Notificar que usuário está online
      socket.emit('user:online', {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        publicKey: user.publicKey,
      });
    });

    // Atualizar lista de usuários online
    socket.on('users:online', (userIds: string[]) => {
      console.log('👥 Usuários online:', userIds);
      setOnlineUsers(userIds);
    });

    // Receber todos os status de usuários
    socket.on('users:statuses', (statuses: Record<string, string>) => {
      console.log('📊 Status dos usuários:', statuses);
      Object.entries(statuses).forEach(([odId, status]) => {
        setUserStatus(odId, status);
      });
    });

    socket.on('user:offline', (userId: string) => {
      console.log('👋 Usuário offline:', userId);
      removeOnlineUser(userId);
      setUserStatus(userId, 'offline');
    });

    // Receber status de usuário
    socket.on('user:status', ({ userId, status }: { userId: string; status: string }) => {
      console.log('📊 Status atualizado:', userId, status);
      setUserStatus(userId, status);
    });

    // Receber nova mensagem
    socket.on('message:new', ({ conversationId, message }) => {
      console.log('📩 Nova mensagem recebida:', message);
      // Não adicionar se foi eu que enviei (já adicionei localmente)
      if (message.senderId !== user.id) {
        addMessage(conversationId, message);
        
        // Mover conversa para o topo
        moveConversationToTop(conversationId);
        
        // Pegar conversa atual do ref
        const currentConv = chatStoreRef.current.currentConversation;
        
        // Incrementar contador de não lidas (se não estiver na conversa)
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
    });

    // Atualização de digitação
    socket.on('typing:update', ({ conversationId, user: typingUser, isTyping }) => {
      if (typingUser.id !== user.id) {
        if (isTyping) {
          addTypingUser(conversationId, typingUser.id);
        } else {
          removeTypingUser(conversationId, typingUser.id);
        }
      }
    });

    // Atualização de reação
    socket.on('message:reaction', ({ conversationId, messageId, reactions }) => {
      updateMessage(conversationId, messageId, { reactions });
    });

    // Nova conversa recebida
    socket.on('conversation:new', ({ conversation }) => {
      console.log('📬 Nova conversa recebida:', conversation);
      addConversation(conversation);
    });

    // Grupo atualizado
    socket.on('group:update', ({ conversationId, update }) => {
      console.log('📝 Grupo atualizado:', conversationId, update);
      updateConversation(conversationId, update);
    });

    // Membro adicionado ao grupo (notificação para o membro adicionado)
    socket.on('group:member:added', async ({ conversationId }) => {
      console.log('➕ Você foi adicionado ao grupo:', conversationId);
      // Recarregar conversas para obter o grupo completo
      try {
        const res = await fetch(`/api/conversations/${conversationId}`, {
          headers: { 'x-user-id': user.id },
        });
        if (res.ok) {
          const conversation = await res.json();
          addConversation(conversation);
        }
      } catch (error) {
        console.error('Erro ao carregar conversa:', error);
      }
    });

    // Novo membro no grupo (para membros existentes)
    socket.on('group:member:new', ({ conversationId, member }) => {
      console.log('👤 Novo membro no grupo:', conversationId, member);
      // Atualizar lista de participantes - será feito ao recarregar a conversa
    });

    // Membro removido (notificação para o membro removido)
    socket.on('group:member:removed', ({ conversationId }) => {
      console.log('➖ Você foi removido do grupo:', conversationId);
      removeConversation(conversationId);
    });

    // Membro saiu do grupo (para membros restantes)
    socket.on('group:member:left', ({ conversationId, memberId }) => {
      console.log('👋 Membro saiu do grupo:', conversationId, memberId);
      // Atualizar lista de participantes - será feito ao recarregar a conversa
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket desconectado');
      isConnectedRef.current = false;
    });

    socket.on('connect_error', (error) => {
      console.error('Erro de conexão socket:', error);
    });

    return () => {
      if (socket) {
        socket.disconnect();
        socketRef.current = null;
        isConnectedRef.current = false;
      }
    };
  }, [user, setOnlineUsers, removeOnlineUser, addMessage, addTypingUser, removeTypingUser, updateMessage, addConversation, updateConversation, removeConversation, moveConversationToTop, incrementUnreadCount, setUserStatus]);

  // Registrar Service Worker e solicitar permissão de notificação
  useEffect(() => {
    if (user) {
      notificationService.registerServiceWorker();
      notificationService.requestPermission();
    }
  }, [user]);

  // Entrar em uma conversa
  const joinConversation = useCallback((conversationId: string) => {
    console.log('🚪 Entrando na conversa:', conversationId);
    socketRef.current?.emit('conversation:join', conversationId);
  }, []);

  // Sair de uma conversa
  const leaveConversation = useCallback((conversationId: string) => {
    console.log('🚶 Saindo da conversa:', conversationId);
    socketRef.current?.emit('conversation:leave', conversationId);
  }, []);

  // Enviar mensagem
  const sendMessage = useCallback((conversationId: string, message: IMessage, participantIds: string[]) => {
    console.log('📤 Enviando mensagem:', message);
    socketRef.current?.emit('message:send', { conversationId, message, participantIds });
  }, []);

  // Indicar que está digitando
  const startTyping = useCallback((conversationId: string) => {
    if (user) {
      socketRef.current?.emit('typing:start', {
        conversationId,
        user: { id: user.id, nickname: user.nickname },
      });
    }
  }, [user]);

  const stopTyping = useCallback((conversationId: string) => {
    if (user) {
      socketRef.current?.emit('typing:stop', {
        conversationId,
        user: { id: user.id, nickname: user.nickname },
      });
    }
  }, [user]);

  // Reagir a mensagem
  const reactToMessage = useCallback((conversationId: string, messageId: string, emoji: string) => {
    if (user) {
      socketRef.current?.emit('message:react', {
        conversationId,
        messageId,
        userId: user.id,
        emoji,
      });
    }
  }, [user]);

  // Notificar nova conversa
  const notifyNewConversation = useCallback((conversation: IConversation, participantIds: string[]) => {
    console.log('📢 Notificando nova conversa:', conversation.id);
    socketRef.current?.emit('conversation:new', { conversation, participantIds });
  }, []);

  // Notificar atualização de grupo
  const notifyGroupUpdate = useCallback((conversationId: string, update: Partial<IConversation>, participantIds: string[]) => {
    console.log('📝 Notificando atualização do grupo:', conversationId);
    socketRef.current?.emit('group:update', { conversationId, update, participantIds });
  }, []);

  // Notificar membro adicionado
  const notifyMemberAdded = useCallback((conversationId: string, member: IUser) => {
    if (user) {
      console.log('➕ Notificando membro adicionado:', member.id);
      socketRef.current?.emit('group:member:add', { 
        conversationId, 
        member, 
        addedBy: { id: user.id, nickname: user.nickname } 
      });
    }
  }, [user]);

  // Notificar membro removido
  const notifyMemberRemoved = useCallback((conversationId: string, memberId: string) => {
    if (user) {
      console.log('➖ Notificando membro removido:', memberId);
      socketRef.current?.emit('group:member:remove', { 
        conversationId, 
        memberId, 
        removedBy: { id: user.id, nickname: user.nickname } 
      });
    }
  }, [user]);

  // Atualizar status do usuário
  const updateUserStatus = useCallback((status: string) => {
    if (user) {
      console.log('📊 Atualizando status para:', status);
      socketRef.current?.emit('user:status', { 
        userId: user.id, 
        status,
      });
    }
  }, [user]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected: isConnectedRef.current,
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
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket deve ser usado dentro de um SocketProvider');
  }
  return context;
}
