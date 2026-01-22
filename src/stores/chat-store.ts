import { create } from 'zustand';
import { IConversation, IMessage, IUser } from '@/types';

interface ChatState {
  conversations: IConversation[];
  currentConversation: IConversation | null;
  messages: Map<string, IMessage[]>;
  typingUsers: Map<string, string[]>; // conversationId -> userIds[]
  onlineUsers: Set<string>;

  // Actions
  setConversations: (conversations: IConversation[]) => void;
  addConversation: (conversation: IConversation) => void;
  updateConversation: (id: string, updates: Partial<IConversation>) => void;
  setCurrentConversation: (conversation: IConversation | null) => void;
  
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
  
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: new Map(),
  typingUsers: new Map(),
  onlineUsers: new Set(),

  setConversations: (conversations) => set({ conversations }),
  
  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
    })),
  
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
  
  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),

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

  reset: () =>
    set({
      conversations: [],
      currentConversation: null,
      messages: new Map(),
      typingUsers: new Map(),
      onlineUsers: new Set(),
    }),
}));
