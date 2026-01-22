'use client';

import { Avatar } from '@/components/ui';
import { IConversation } from '@/types';
import { cn, formatDate, truncate } from '@/lib/utils';
import { useAuthStore, useChatStore } from '@/stores';
import { Users } from 'lucide-react';

interface ConversationListProps {
  conversations: IConversation[];
  onSelect: (conversation: IConversation) => void;
}

export function ConversationList({ conversations, onSelect }: ConversationListProps) {
  const { user } = useAuthStore();
  const { currentConversation, onlineUsers } = useChatStore();

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-dark-500 text-sm text-center">
          Nenhuma conversa ainda.
          <br />
          Adicione amigos para começar!
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conversation) => {
        // Para grupos
        if (conversation.isGroup) {
          const isSelected = currentConversation?.id === conversation.id;
          const onlineCount = conversation.participants.filter(
            p => p.id !== user?.id && onlineUsers.has(p.id)
          ).length;

          return (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation)}
              className={cn(
                'w-full flex items-center gap-3 p-3 hover:bg-dark-700 transition-colors',
                isSelected && 'bg-dark-700'
              )}
            >
              <div className="relative">
                <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center">
                  <Users size={24} className="text-white" />
                </div>
                {onlineCount > 0 && (
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full text-xs text-white flex items-center justify-center border-2 border-dark-800">
                    {onlineCount}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white truncate">
                    {conversation.name}
                  </span>
                  {conversation.lastMessage && (
                    <span className="text-xs text-dark-500">
                      {formatDate(conversation.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-dark-400 truncate">
                  {conversation.participants.length} participantes
                </p>
              </div>
              {conversation.unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-primary-600 text-white text-xs font-medium rounded-full">
                  {conversation.unreadCount}
                </span>
              )}
            </button>
          );
        }

        // Para DMs (conversas 1:1)
        const otherParticipant = conversation.participants.find(
          (p) => p.id !== user?.id
        );

        if (!otherParticipant) return null;

        const isOnline = onlineUsers.has(otherParticipant.id);
        const isSelected = currentConversation?.id === conversation.id;

        return (
          <button
            key={conversation.id}
            onClick={() => onSelect(conversation)}
            className={cn(
              'w-full flex items-center gap-3 p-3 hover:bg-dark-700 transition-colors',
              isSelected && 'bg-dark-700'
            )}
          >
            <Avatar
              src={otherParticipant.avatar}
              name={otherParticipant.nickname}
              size="md"
              status={isOnline ? 'online' : 'offline'}
            />
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white truncate">
                  {otherParticipant.nickname}
                </span>
                {conversation.lastMessage && (
                  <span className="text-xs text-dark-500">
                    {formatDate(conversation.lastMessage.createdAt)}
                  </span>
                )}
              </div>
              {conversation.lastMessage && (
                <p className="text-sm text-dark-400 truncate">
                  {conversation.lastMessage.type === 'gif'
                    ? '🎬 GIF'
                    : conversation.lastMessage.type === 'image'
                    ? '📷 Imagem'
                    : truncate(conversation.lastMessage.content || '', 30)}
                </p>
              )}
            </div>
            {conversation.unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-primary-600 text-white text-xs font-medium rounded-full">
                {conversation.unreadCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
