import { create } from 'zustand';
import { IConversation, IMessage, IUser } from '@/types';

interface ChatState {
  conversations: IConversation[];
  currentConversation: IConversation | null;
  messages: Map<string, IMessage[]>;
  typingUsers: Map<string, string[]>; // conversationId -> userIds[]
  onlineUsers: Set<string>;
  userStatuses: Map<string, string>; // userId -> status (online, offline, busy, away)

  // Actions
  setConversations: (conversations: IConversation[]) => void;
  addConversation: (conversation: IConversation) => void;
  updateConversation: (id: string, updates: Partial<IConversation>) => void;
  removeConversation: (id: string) => void;
  setCurrentConversation: (conversation: IConversation | null) => void;
  moveConversationToTop: (conversationId: string) => void;
  incrementUnreadCount: (conversationId: string) => void;
  resetUnreadCount: (conversationId: string) => void;
  
  setMessages: (conversationId: string, messages: IMessage[]) => void;
  addMessage: (conversationId: string, message: IMessage) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<IMessage>) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  
  setTypingUsers: (conversationId: string, userIds: string[]) => void;
  addTypingUser: (conversationId: string, userId: string) => void;
  removeTypingUser: (conversationId: string, userId: string) => void;
  
  setOnlineUsers: (userIds: string[]) => void;
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;
  setUserStatus: (userId: string, status: string) => void;
  getUserStatus: (userId: string) => string;
  
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: new Map(),
  typingUsers: new Map(),
  onlineUsers: new Set(),
  userStatuses: new Map(),

  setConversations: (conversations) => set({ conversations }),
  
  addConversation: (conversation) =>
    set((state) => {
      // Verificar se já existe
      const exists = state.conversations.some(c => c.id === conversation.id);
      if (exists) return state;
      return { conversations: [conversation, ...state.conversations] };
    }),
  
  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
      currentConversation:
        state.currentConversation?.id === id
          ? { ...state.currentConversation, ...updates }
          : state.currentConversation,
    })),

  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      currentConversation:
        state.currentConversation?.id === id ? null : state.currentConversation,
    })),
  
  setCurrentConversation: (conversation) => {
    // Resetar unread quando seleciona conversa
    if (conversation) {
      get().resetUnreadCount(conversation.id);
    }
    set({ currentConversation: conversation });
  },

  moveConversationToTop: (conversationId) =>
    set((state) => {
      const index = state.conversations.findIndex(c => c.id === conversationId);
      if (index <= 0) return state; // Já está no topo ou não existe
      
      const conversation = state.conversations[index];
      const newConversations = [
        conversation,
        ...state.conversations.slice(0, index),
        ...state.conversations.slice(index + 1),
      ];
      
      return { conversations: newConversations };
    }),

  incrementUnreadCount: (conversationId) =>
    set((state) => {
      // Não incrementar se a conversa está aberta
      if (state.currentConversation?.id === conversationId) return state;
      
      return {
        conversations: state.conversations.map((c) =>
          c.id === conversationId 
            ? { ...c, unreadCount: (c.unreadCount || 0) + 1 }
            : c
        ),
      };
    }),

  resetUnreadCount: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ),
    })),

  setMessages: (conversationId, messages) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      newMessages.set(conversationId, messages);
      return { messages: newMessages };
    }),
  
  addMessage: (conversationId, message) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const existing = newMessages.get(conversationId) || [];
      newMessages.set(conversationId, [...existing, message]);
      return { messages: newMessages };
    }),
  
  updateMessage: (conversationId, messageId, updates) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const existing = newMessages.get(conversationId) || [];
      newMessages.set(
        conversationId,
        existing.map((m) => (m.id === messageId ? { ...m, ...updates } : m))
      );
      return { messages: newMessages };
    }),
  
  deleteMessage: (conversationId, messageId) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const existing = newMessages.get(conversationId) || [];
      newMessages.set(
        conversationId,
        existing.filter((m) => m.id !== messageId)
      );
      return { messages: newMessages };
    }),

  setTypingUsers: (conversationId, userIds) =>
    set((state) => {
      const newTypingUsers = new Map(state.typingUsers);
      newTypingUsers.set(conversationId, userIds);
      return { typingUsers: newTypingUsers };
    }),
  
  addTypingUser: (conversationId, userId) =>
    set((state) => {
      const newTypingUsers = new Map(state.typingUsers);
      const existing = newTypingUsers.get(conversationId) || [];
      if (!existing.includes(userId)) {
        newTypingUsers.set(conversationId, [...existing, userId]);
      }
      return { typingUsers: newTypingUsers };
    }),
  
  removeTypingUser: (conversationId, userId) =>
    set((state) => {
      const newTypingUsers = new Map(state.typingUsers);
      const existing = newTypingUsers.get(conversationId) || [];
      newTypingUsers.set(
        conversationId,
        existing.filter((id) => id !== userId)
      );
      return { typingUsers: newTypingUsers };
    }),

  setOnlineUsers: (userIds) => set({ onlineUsers: new Set(userIds) }),
  
  addOnlineUser: (userId) =>
    set((state) => {
      const newOnlineUsers = new Set(state.onlineUsers);
      newOnlineUsers.add(userId);
      return { onlineUsers: newOnlineUsers };
    }),
  
  removeOnlineUser: (userId) =>
    set((state) => {
      const newOnlineUsers = new Set(state.onlineUsers);
      newOnlineUsers.delete(userId);
      return { onlineUsers: newOnlineUsers };
    }),

  setUserStatus: (userId, status) =>
    set((state) => {
      const newStatuses = new Map(state.userStatuses);
      newStatuses.set(userId, status);
      return { userStatuses: newStatuses };
    }),

  getUserStatus: (userId) => {
    return get().userStatuses.get(userId) || 'offline';
  },

  reset: () =>
    set({
      conversations: [],
      currentConversation: null,
      messages: new Map(),
      typingUsers: new Map(),
      onlineUsers: new Set(),
      userStatuses: new Map(),
    }),
}));
