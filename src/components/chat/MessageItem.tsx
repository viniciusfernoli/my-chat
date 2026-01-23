'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { MoreVertical, Reply, Smile, Trash2, X, Download, ZoomIn, Plus } from 'lucide-react';
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

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

const ALL_EMOJIS = {
  'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '😏', '😒', '🙄', '😬', '🤥'],
  'Gestos': ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '👈', '👉', '👆', '👇', '👋', '🤚', '✋', '🖖', '👏', '🙌', '🤝', '🙏', '💪'],
  'Corações': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '💕', '💞', '💓', '💗', '💖', '💝', '💘'],
  'Objetos': ['🎉', '🎊', '🎁', '🎈', '✨', '🌟', '⭐', '💫', '🔥', '💯', '🏆', '🥇', '🎮', '🎯', '🎵', '🎶'],
};

// Componente de picker completo de reações
function FullEmojiPicker({
  onSelect,
  onClose,
  position,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Smileys');

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Ajustar posição se necessário
  const adjustedPosition = { ...position };
  const pickerWidth = 280;
  const pickerHeight = 260;
  
  if (adjustedPosition.left + pickerWidth > window.innerWidth - 8) {
    adjustedPosition.left = window.innerWidth - pickerWidth - 8;
  }
  if (adjustedPosition.left < 8) {
    adjustedPosition.left = 8;
  }
  if (adjustedPosition.top + pickerHeight > window.innerHeight - 8) {
    adjustedPosition.top = position.top - pickerHeight - 60;
  }

  return createPortal(
    <div
      ref={ref}
      style={{ top: adjustedPosition.top, left: adjustedPosition.left }}
      className="fixed z-[10000] w-70 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl overflow-hidden"
    >
      {/* Categories */}
      <div className="flex border-b border-dark-700 overflow-x-auto scrollbar-hide">
        {Object.keys(ALL_EMOJIS).map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={cn(
              'px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors',
              activeCategory === category
                ? 'text-primary-400 border-b-2 border-primary-400'
                : 'text-dark-400 hover:text-white'
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Emojis Grid */}
      <div className="h-44 overflow-y-auto p-2 grid grid-cols-8 gap-1">
        {ALL_EMOJIS[activeCategory as keyof typeof ALL_EMOJIS].map((emoji, index) => (
          <button
            key={index}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center text-xl hover:bg-dark-700 rounded transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}

// Componente de picker de reações usando Portal
function ReactionPicker({
  onSelect,
  onClose,
  triggerRef,
  isOwn,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  isOwn: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showFullPicker, setShowFullPicker] = useState(false);

  useEffect(() => {
    // Calcular posição baseada no botão trigger
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const pickerWidth = 300;
      
      let left = isOwn ? rect.right - pickerWidth : rect.left;
      let top = rect.bottom + 8;
      
      // Verificar se ultrapassa a tela à direita
      if (left + pickerWidth > window.innerWidth - 16) {
        left = window.innerWidth - pickerWidth - 16;
      }
      
      // Verificar se ultrapassa a tela à esquerda
      if (left < 16) {
        left = 16;
      }
      
      // Verificar se ultrapassa a tela embaixo
      if (top + 60 > window.innerHeight) {
        top = rect.top - 60;
      }
      
      setPosition({ top, left });
    }
  }, [triggerRef, isOwn]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node) && 
          triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        if (!showFullPicker) {
          onClose();
        }
      }
    }
    
    function handleScroll() {
      if (!showFullPicker) {
        onClose();
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', handleScroll, true);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose, triggerRef, showFullPicker]);

  if (showFullPicker) {
    return (
      <FullEmojiPicker
        onSelect={(emoji) => {
          onSelect(emoji);
          onClose();
        }}
        onClose={() => {
          setShowFullPicker(false);
          onClose();
        }}
        position={position}
      />
    );
  }

  // Usar portal para renderizar fora do container
  return createPortal(
    <div
      ref={ref}
      style={{ top: position.top, left: position.left }}
      className="fixed z-[9999] bg-dark-800 border border-dark-600 rounded-xl shadow-2xl p-2 transition-opacity duration-150"
    >
      <div className="flex gap-1">
        {QUICK_REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-dark-600 rounded-lg transition-colors"
          >
            {emoji}
          </button>
        ))}
        {/* Botão para abrir picker completo */}
        <button
          onClick={() => setShowFullPicker(true)}
          className="w-10 h-10 flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-600 rounded-lg transition-colors"
          title="Mais emojis"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>,
    document.body
  );
}

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
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const reactionButtonRef = useRef<HTMLButtonElement>(null);
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
    >
      {/* Avatar */}
      {showAvatar && (
        <Avatar
          src={message.sender?.avatar}
          name={message.sender?.nickname}
          username={message.sender?.username}
          size="sm"
          className="shrink-0 mt-0.5"
          showTooltip
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
            <span className="text-primary-400">
              {message.replyTo.sender?.nickname || message.replyTo.senderNickname || 'Usuário'}:{' '}
            </span>
            <span className="italic truncate block">
              {message.replyTo.content || 'Mensagem'}
            </span>
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
          {/* Renderizar GIF - verificar também no metadata para mensagens antigas */}
          {(message.type === 'gif' || message.metadata?.gifUrl) && (message.gifUrl || message.metadata?.gifUrl) ? (
            <div className="relative w-48 h-48 rounded-lg overflow-hidden">
              <Image
                src={(message.gifUrl || message.metadata?.gifUrl) as string}
                alt={message.content || 'GIF'}
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (message.type === 'image' || message.metadata?.mediaUrl) && (message.mediaUrl || message.metadata?.mediaUrl) ? (
            <>
              <div 
                className="relative w-64 max-w-full rounded-lg overflow-hidden cursor-pointer group"
                onClick={() => setShowImageModal(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={(message.mediaUrl || message.metadata?.mediaUrl) as string}
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
                  src={(message.mediaUrl || message.metadata?.mediaUrl) as string}
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
        {/* Reaction button */}
        <button
          ref={reactionButtonRef}
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            showReactionPicker 
              ? 'text-primary-400 bg-dark-700' 
              : 'text-dark-400 hover:text-white hover:bg-dark-700'
          )}
          onClick={() => setShowReactionPicker(!showReactionPicker)}
        >
          <Smile size={16} />
        </button>
        
        {showReactionPicker && (
          <ReactionPicker
            onSelect={(emoji) => onReact(message.id, emoji)}
            onClose={() => setShowReactionPicker(false)}
            triggerRef={reactionButtonRef}
            isOwn={isOwn}
          />
        )}

        <Dropdown trigger={<MoreVertical size={16} />} items={dropdownItems} align={isOwn ? "left" : "right"} />
      </div>
    </div>
  );
}
