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
  const { messages, addMessage, onlineUsers, updateMessage, setCurrentConversation } = useChatStore();
  const [replyTo, setReplyTo] = useState<IMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const { joinConversation, leaveConversation, sendMessage, startTyping, stopTyping, reactToMessage } = useSocket();
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);

  // Encontrar o outro participante (ou participantes em grupo)
  const otherParticipant = conversation.participants.find(
    (p) => p.id !== user?.id
  );
  
  // Para grupos, mostrar se algum membro está online
  const isOnline = conversation.participants.some(
    (p) => p.id !== user?.id && onlineUsers.has(p.id)
  );

  const conversationMessages = messages.get(conversation.id) || [];

  // Entrar na sala da conversa ao abrir
  useEffect(() => {
    if (conversation.id) {
      joinConversation(conversation.id);
      setIsLoading(false);
    }
    
    return () => {
      if (conversation.id) {
        leaveConversation(conversation.id);
      }
    };
  }, [conversation.id, joinConversation, leaveConversation]);

  const handleSendMessage = async (
    content: string,
    type: 'text' | 'gif' | 'image',
    gifUrl?: string
  ) => {
    if (!user) return;

    // Criar mensagem localmente (sem criptografia E2E para simplificar)
    const newMessage: IMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId: conversation.id,
      senderId: user.id,
      content: type === 'gif' ? 'GIF' : content,
      type,
      gifUrl: type === 'gif' ? gifUrl : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isEdited: false,
      reactions: [],
      sender: {
        id: user.id,
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

    // Adicionar mensagem localmente
    addMessage(conversation.id, newMessage);
    
    // Enviar via WebSocket
    sendMessage(conversation.id, newMessage);
    
    setReplyTo(null);
    
    // Parar de digitar
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
    }
    stopTyping(conversation.id);
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
