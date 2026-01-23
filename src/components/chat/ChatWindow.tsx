'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Phone, Video, MoreVertical, ArrowLeft, Settings } from 'lucide-react';
import { Avatar, Dropdown } from '@/components/ui';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { GroupSettingsModal } from './GroupSettingsModal';
import { IConversation, IMessage } from '@/types';
import { useAuthStore, useChatStore } from '@/stores';
import { useSocket } from '@/hooks/useSocket';

interface ChatWindowProps {
  conversation: IConversation;
  onBack?: () => void;
}

export function ChatWindow({ conversation, onBack }: ChatWindowProps) {
  const { user } = useAuthStore();
  const { messages, addMessage, onlineUsers, updateMessage, setCurrentConversation, prependMessages } = useChatStore();
  const [replyTo, setReplyTo] = useState<IMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const { joinConversation, leaveConversation, sendMessage, startTyping, stopTyping, reactToMessage } = useSocket();
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const loadedConversations = useRef(new Set<string>());

  // Encontrar o outro participante (ou participantes em grupo)
  const otherParticipant = conversation.participants.find(
    (p) => p.id !== user?.id
  );
  
  // Para grupos, mostrar se algum membro está online
  const isOnline = conversation.participants.some(
    (p) => p.id !== user?.id && onlineUsers.has(p.id)
  );

  const conversationMessages = messages.get(conversation.id) || [];

  // Carregar mensagens iniciais
  const loadInitialMessages = useCallback(async () => {
    if (loadedConversations.current.has(conversation.id)) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/conversations/${conversation.id}/messages?limit=20`, {
        headers: {
          'x-user-id': user?.id || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        // Limpar e adicionar mensagens
        if (data.messages && data.messages.length > 0) {
          data.messages.forEach((msg: IMessage) => {
            addMessage(conversation.id, msg);
          });
        }
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore || false);
        loadedConversations.current.add(conversation.id);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setIsLoading(false);
    }
  }, [conversation.id, user?.id, addMessage]);

  // Carregar mais mensagens (scroll infinito)
  const loadMoreMessages = useCallback(async () => {
    if (isLoadingMore || !hasMore || !nextCursor) return;
    
    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `/api/conversations/${conversation.id}/messages?limit=20&cursor=${nextCursor}`,
        {
          headers: {
            'x-user-id': user?.id || '',
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          // Prepend - adicionar no início da lista
          prependMessages(conversation.id, data.messages);
        }
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore || false);
      }
    } catch (error) {
      console.error('Erro ao carregar mais mensagens:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversation.id, user?.id, isLoadingMore, hasMore, nextCursor, prependMessages]);

  // Entrar na sala da conversa ao abrir
  useEffect(() => {
    if (conversation.id) {
      // Carregar mensagens iniciais
      loadInitialMessages();
      
      // Enviar participantIds para validação no servidor
      const participantIds = conversation.participants.map(p => p.id);
      joinConversation(conversation.id, participantIds);
    }
    
    return () => {
      if (conversation.id) {
        leaveConversation(conversation.id);
      }
    };
  }, [conversation.id, conversation.participants, joinConversation, leaveConversation, loadInitialMessages]);

  const handleSendMessage = async (
    content: string,
    type: 'text' | 'gif' | 'image',
    mediaUrl?: string
  ) => {
    if (!user) return;

    // ID temporário para a mensagem local
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Criar mensagem localmente (otimistic update)
    const newMessage: IMessage = {
      id: tempId,
      conversationId: conversation.id,
      senderId: user.id,
      content: type === 'gif' ? 'GIF' : content,
      type,
      gifUrl: type === 'gif' ? mediaUrl : undefined,
      mediaUrl: type === 'image' ? mediaUrl : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEdited: false,
      reactions: [],
      sender: {
        id: user.id,
        username: user.username || '',
        nickname: user.nickname,
        avatar: user.avatar,
        publicKey: user.publicKey || '',
      },
      replyTo: replyTo ? {
        id: replyTo.id,
        content: replyTo.content,
        senderId: replyTo.senderId,
        senderNickname: replyTo.sender?.nickname || 'Usuário',
      } : undefined,
    };

    // Adicionar mensagem localmente (optimistic update)
    addMessage(conversation.id, newMessage);
    
    setReplyTo(null);
    
    // Parar de digitar
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
    }
    stopTyping(conversation.id);

    try {
      // Salvar mensagem no Firebase via API
      const response = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          encryptedContent: content, // Por enquanto sem criptografia E2E
          nonce: 'placeholder', // Placeholder para manter compatibilidade
          type,
          mediaUrl: type === 'image' ? mediaUrl : undefined,
          gifUrl: type === 'gif' ? mediaUrl : undefined,
          replyToId: replyTo?.id,
        }),
      });

      if (response.ok) {
        const savedMessage = await response.json();
        
        // Atualizar ID da mensagem local com o ID real do Firebase
        updateMessage(conversation.id, tempId, { 
          id: savedMessage.id,
          createdAt: savedMessage.createdAt,
          updatedAt: savedMessage.updatedAt,
        });

        // Enviar via WebSocket para todos os participantes (com ID real)
        const participantIds = conversation.participants.map(p => p.id);
        sendMessage(conversation.id, { ...newMessage, id: savedMessage.id }, participantIds);
      } else {
        console.error('[CHAT] Erro ao salvar mensagem:', await response.text());
        // TODO: Marcar mensagem como falha ou remover
      }
    } catch (error) {
      console.error('[CHAT] Erro ao salvar mensagem:', error);
      // TODO: Marcar mensagem como falha ou remover
    }
  };

  const handleTyping = useCallback(() => {
    startTyping(conversation.id);
    
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    
    typingTimeout.current = setTimeout(() => {
      stopTyping(conversation.id);
    }, 2000);
  }, [conversation.id, startTyping, stopTyping]);

  const handleReact = async (messageId: string, emoji: string) => {
    if (!user) return;

    // Atualizar localmente
    const msg = conversationMessages.find(m => m.id === messageId);
    if (msg) {
      const existingReaction = msg.reactions.find(
        r => r.emoji === emoji && r.userId === user.id
      );
      
      let newReactions;
      if (existingReaction) {
        // Remover reação
        newReactions = msg.reactions.filter(
          r => !(r.emoji === emoji && r.userId === user.id)
        );
      } else {
        // Adicionar reação
        newReactions = [
          ...msg.reactions,
          {
            id: `react_${Date.now()}`,
            messageId,
            userId: user.id,
            emoji,
            createdAt: new Date().toISOString(),
          }
        ];
      }
      
      updateMessage(conversation.id, messageId, { reactions: newReactions });
    }

    // Enviar via WebSocket
    reactToMessage(conversation.id, messageId, emoji);

    // Salvar reação no Firebase
    try {
      await fetch(`/api/conversations/${conversation.id}/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({ emoji }),
      });
    } catch (error) {
      console.error('[CHAT] Erro ao salvar reação:', error);
    }
  };

  // Nome da conversa (grupo ou pessoa)
  const conversationName = conversation.isGroup
    ? conversation.name
    : otherParticipant?.nickname;
    
  const conversationAvatar = conversation.isGroup
    ? conversation.avatar
    : otherParticipant?.avatar;

  const dropdownItems = [
    {
      label: 'Ver perfil',
      onClick: () => {},
    },
    ...(conversation.isGroup ? [{
      label: 'Configurações do grupo',
      onClick: () => setShowGroupSettings(true),
    }] : []),
    {
      label: 'Limpar conversa',
      onClick: () => {},
      danger: true,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-dark-900">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-dark-700 bg-dark-800">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors md:hidden"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        
        <Avatar
          src={conversationAvatar}
          name={conversationName}
          size="md"
          status={isOnline ? 'online' : 'offline'}
        />
        
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-white truncate">
            {conversationName}
          </h2>
          <p className="text-xs text-dark-400">
            {conversation.isGroup 
              ? `${conversation.participants.length} participantes`
              : isOnline ? 'Online' : 'Offline'}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors">
            <Phone size={20} />
          </button>
          <button className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors">
            <Video size={20} />
          </button>
          <Dropdown
            trigger={
              <button className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors">
                <MoreVertical size={20} />
              </button>
            }
            items={dropdownItems}
            align="right"
          />
        </div>
      </div>

      {/* Messages */}
      <MessageList
        messages={conversationMessages}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        onLoadMore={loadMoreMessages}
        onReply={setReplyTo}
        onReact={handleReact}
      />

      {/* Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      {/* Group Settings Modal */}
      {conversation.isGroup && (
        <GroupSettingsModal
          isOpen={showGroupSettings}
          onClose={() => setShowGroupSettings(false)}
          conversation={conversation}
          onGroupDeleted={() => {
            setCurrentConversation(null);
            onBack?.();
          }}
        />
      )}
    </div>
  );
}
