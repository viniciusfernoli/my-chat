'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MoreVertical, Reply, Smile, Trash2, X, Download, ZoomIn } from 'lucide-react';
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

// Modal de imagem em tela cheia
function ImageModal({ 
  src, 
  alt, 
  onClose 
}: { 
  src: string; 
  alt: string; 
  onClose: () => void;
}) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = `image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="p-2 bg-dark-800/80 rounded-lg text-white hover:bg-dark-700 transition-colors"
          title="Baixar imagem"
        >
          <Download size={20} />
        </button>
        <button
          onClick={onClose}
          className="p-2 bg-dark-800/80 rounded-lg text-white hover:bg-dark-700 transition-colors"
          title="Fechar"
        >
          <X size={20} />
        </button>
      </div>
      <div 
        className="relative max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[90vh] object-contain rounded-lg"
        />
      </div>
    </div>
  );
}

export function MessageItem({
  message,
  onReply,
  onReact,
  onDelete,
  showAvatar = true,
}: MessageItemProps) {
  const { user } = useAuthStore();
  const [showReactions, setShowReactions] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
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
        'group flex gap-3 px-4 py-1 hover:bg-dark-800/50 transition-colors overflow-hidden',
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
      <div className={cn('min-w-0 max-w-[70%] flex flex-col', isOwn ? 'items-end' : 'items-start')}>
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
          <div className="text-xs text-dark-400 mb-1 p-2 bg-dark-700/50 rounded-lg border-l-2 border-primary-500 max-w-full">
            <span className="text-primary-400">{message.replyTo.sender?.nickname}: </span>
            <span className="italic">Mensagem criptografada</span>
          </div>
        )}

        {/* Message content */}
        <div
          className={cn(
            'rounded-2xl px-4 py-2 max-w-full break-words',
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
            <>
              <div 
                className="relative w-64 max-w-full rounded-lg overflow-hidden cursor-pointer group"
                onClick={() => setShowImageModal(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={message.mediaUrl}
                  alt="Imagem"
                  className="max-w-full h-auto rounded-lg"
                  style={{ maxHeight: '300px' }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <ZoomIn 
                    size={32} 
                    className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" 
                  />
                </div>
              </div>
              {message.content && message.content !== 'Imagem' && (
                <p className="mt-2 whitespace-pre-wrap break-words">{message.content}</p>
              )}
              {showImageModal && (
                <ImageModal
                  src={message.mediaUrl}
                  alt="Imagem"
                  onClose={() => setShowImageModal(false)}
                />
              )}
            </>
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </div>

        {/* Reactions */}
        {Object.keys(groupedReactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 max-w-full">
            {Object.entries(groupedReactions).map(([emoji, reactions]) => (
              <button
                key={emoji}
                onClick={() => onReact(message.id, emoji)}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors shrink-0',
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
          'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0',
          isOwn && 'order-first'
        )}
      >
        {/* Quick reactions */}
        <div className="relative">
          {showReactions && (
            <div 
              className={cn(
                "absolute bottom-full mb-1 flex gap-1 p-1 bg-dark-700 rounded-full shadow-lg animate-fade-in z-50",
                isOwn ? "right-0" : "left-0"
              )}
            >
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

        <Dropdown trigger={<MoreVertical size={16} />} items={dropdownItems} align={isOwn ? "left" : "right"} />
      </div>
    </div>
  );
}
