'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MoreVertical, Reply, Smile, Trash2 } from 'lucide-react';
import { Avatar, Dropdown, Tooltip } from '@/components/ui';
import { IMessage, IReaction } from '@/types';
import { cn, formatTime } from '@/lib/utils';
import { useAuthStore } from '@/stores';

interface MessageItemProps {
  message: IMessage;
  onReply: (message: IMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
  showAvatar?: boolean;
}

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export function MessageItem({
  message,
  onReply,
  onReact,
  onDelete,
  showAvatar = true,
}: MessageItemProps) {
  const { user } = useAuthStore();
  const [showReactions, setShowReactions] = useState(false);
  const isOwn = message.senderId === user?.id;

  // Agrupar reações por emoji
  const groupedReactions = message.reactions?.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, IReaction[]>) || {};

  const dropdownItems = [
    {
      label: 'Responder',
      icon: <Reply size={16} />,
      onClick: () => onReply(message),
    },
    ...(isOwn && onDelete
      ? [
          {
            label: 'Excluir',
            icon: <Trash2 size={16} />,
            onClick: () => onDelete(message.id),
            danger: true,
          },
        ]
      : []),
  ];

  return (
    <div
      className={cn(
        'group flex gap-3 px-4 py-1 hover:bg-dark-800/50 transition-colors',
        isOwn && 'flex-row-reverse'
      )}
      onMouseEnter={() => setShowReactions(true)}
      onMouseLeave={() => setShowReactions(false)}
    >
      {/* Avatar */}
      {showAvatar && (
        <Avatar
          src={message.sender?.avatar}
          name={message.sender?.nickname}
          size="sm"
          className="shrink-0 mt-0.5"
        />
      )}
      {!showAvatar && <div className="w-8 shrink-0" />}

      {/* Content */}
      <div className={cn('flex-1 max-w-[70%]', isOwn && 'flex flex-col items-end')}>
        {/* Header */}
        {showAvatar && (
          <div className={cn('flex items-baseline gap-2 mb-0.5', isOwn && 'flex-row-reverse')}>
            <span className="text-sm font-medium text-white">
              {message.sender?.nickname}
            </span>
            <span className="text-xs text-dark-500">
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}

        {/* Reply preview */}
        {message.replyTo && typeof message.replyTo === 'object' && (
          <div className="text-xs text-dark-400 mb-1 p-2 bg-dark-700/50 rounded-lg border-l-2 border-primary-500">
            <span className="text-primary-400">{message.replyTo.sender?.nickname}: </span>
            <span className="italic">Mensagem criptografada</span>
          </div>
        )}

        {/* Message content */}
        <div
          className={cn(
            'rounded-2xl px-4 py-2',
            isOwn
              ? 'bg-primary-600 text-white rounded-tr-sm'
              : 'bg-dark-700 text-white rounded-tl-sm'
          )}
        >
          {message.type === 'gif' && message.gifUrl ? (
            <div className="relative w-48 h-48 rounded-lg overflow-hidden">
              <Image
                src={message.gifUrl}
                alt={message.content || 'GIF'}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : message.type === 'image' && message.mediaUrl ? (
            <div className="relative w-64 h-48 rounded-lg overflow-hidden">
              <Image
                src={message.mediaUrl}
                alt="Imagem"
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>

        {/* Reactions */}
        {Object.keys(groupedReactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(groupedReactions).map(([emoji, reactions]) => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors',
                  reactions.some((r) => r.userId === user?.id)
                    ? 'bg-primary-600/30 text-primary-300'
                    : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
                )}
              >
                <span>{emoji}</span>
                <span>{reactions.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className={cn(
          'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity',
          isOwn && 'order-first'
        )}
      >
        {/* Quick reactions */}
        <div className="relative">
          {showReactions && (
            <div className="absolute bottom-full mb-1 flex gap-1 p-1 bg-dark-700 rounded-full shadow-lg animate-fade-in">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onReact(message.id, emoji)}
                  className="w-7 h-7 flex items-center justify-center text-sm hover:bg-dark-600 rounded-full transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <button
            className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
            onClick={() => setShowReactions(!showReactions)}
          >
            <Smile size={16} />
          </button>
        </div>

        <Dropdown trigger={<MoreVertical size={16} />} items={dropdownItems} />
      </div>
    </div>
  );
}
