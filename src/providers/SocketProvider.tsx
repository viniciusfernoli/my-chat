'use client';

import { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore, useChatStore } from '@/stores';
import { IMessage } from '@/types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendMessage: (conversationId: string, message: IMessage) => void;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  reactToMessage: (conversationId: string, messageId: string, emoji: string) => void;
}

const SocketContext = createContext<SocketContextType | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const { user } = useAuthStore();
  const {
    addMessage,
    setOnlineUsers,
    removeOnlineUser,
    addTypingUser,
    removeTypingUser,
    updateMessage,
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

    socket.on('user:offline', (userId: string) => {
      console.log('👋 Usuário offline:', userId);
      removeOnlineUser(userId);
    });

    // Receber nova mensagem
    socket.on('message:new', ({ conversationId, message }) => {
      console.log('📩 Nova mensagem recebida:', message);
      // Não adicionar se foi eu que enviei (já adicionei localmente)
      if (message.senderId !== user.id) {
        addMessage(conversationId, message);
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
  }, [user, setOnlineUsers, removeOnlineUser, addMessage, addTypingUser, removeTypingUser, updateMessage]);

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
  const sendMessage = useCallback((conversationId: string, message: IMessage) => {
    console.log('📤 Enviando mensagem:', message);
    socketRef.current?.emit('message:send', { conversationId, message });
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
