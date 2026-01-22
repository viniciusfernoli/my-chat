'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Plus, Settings, LogOut, Search, Users } from 'lucide-react';
import { Avatar, Button, Input, Spinner } from '@/components/ui';
import { ConversationList, ChatWindow, NewChatModal, CreateGroupModal } from '@/components/chat';
import { useAuthStore, useChatStore } from '@/stores';
import { IConversation } from '@/types';
import { cn } from '@/lib/utils';

export default function ChatPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuthStore();
  const {
    conversations,
    setConversations,
    currentConversation,
    setCurrentConversation,
    addConversation,
  } = useChatStore();

  const [isLoading, setIsLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);

  // Verificar autenticação
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth');
    }
  }, [authLoading, isAuthenticated, router]);

  // Carregar conversas
  const loadConversations = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/conversations', {
        headers: {
          'x-user-id': user.id,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, setConversations]);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  // Criar nova conversa
  const handleNewChat = async (participantId: string) => {
    if (!user) return;

    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({ participantId }),
      });

      if (res.ok) {
        const conversation = await res.json();
        
        // Verificar se já existe
        const existing = conversations.find((c) => c.id === conversation.id);
        if (!existing) {
          addConversation(conversation);
        }
        
        setCurrentConversation(conversation);
        setShowSidebar(false);
      }
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/auth');
  };

  // Filtrar conversas por busca
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    
    // Para grupos, buscar pelo nome
    if (conv.isGroup) {
      return conv.name?.toLowerCase().includes(searchQuery.toLowerCase());
    }
    
    // Para DMs, buscar pelo nome do outro participante
    const otherParticipant = conv.participants.find((p) => p.id !== user?.id);
    return otherParticipant?.nickname
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
  });

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-dark-950">
      {/* Sidebar */}
      <div
        className={cn(
          'w-full md:w-80 flex flex-col bg-dark-800 border-r border-dark-700',
          'absolute md:relative inset-0 z-10 transition-transform duration-300',
          !showSidebar && '-translate-x-full md:translate-x-0'
        )}
      >
        {/* User header */}
        <div className="p-4 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <Avatar
              src={user.avatar}
              name={user.nickname}
              size="lg"
              status="online"
            />
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-white truncate">
                {user.nickname}
              </h2>
              <p className="text-xs text-green-400">Online</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-dark-700 transition-colors"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Search and new chat */}
        <div className="p-4 space-y-3">
          <Input
            placeholder="Buscar conversas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search size={16} />}
          />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setShowNewChat(true)}>
              <Plus size={16} className="mr-2" />
              Nova Conversa
            </Button>
            <Button 
              variant="secondary" 
              onClick={() => setShowCreateGroup(true)}
              title="Criar Grupo"
            >
              <Users size={16} />
            </Button>
          </div>
        </div>

        {/* Conversations */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <ConversationList
            conversations={filteredConversations}
            onSelect={(conv) => {
              setCurrentConversation(conv);
              setShowSidebar(false);
            }}
          />
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {currentConversation ? (
          <ChatWindow
            conversation={currentConversation}
            onBack={() => setShowSidebar(true)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-dark-900">
            <div className="text-center">
              <div className="w-20 h-20 bg-dark-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-10 h-10 text-dark-600" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                SecureChat
              </h2>
              <p className="text-dark-400 max-w-sm">
                Selecione uma conversa ou inicie uma nova para começar a trocar
                mensagens criptografadas.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New chat modal */}
      <NewChatModal
        isOpen={showNewChat}
        onClose={() => setShowNewChat(false)}
        onSelectUser={handleNewChat}
      />

      {/* Create group modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onGroupCreated={(group) => {
          addConversation(group);
          setCurrentConversation(group);
          setShowSidebar(false);
        }}
      />
    </div>
  );
}
