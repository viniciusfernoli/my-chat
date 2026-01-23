'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { MessageItem } from './MessageItem';
import { Spinner } from '@/components/ui';
import { IMessage } from '@/types';

interface MessageListProps {
  messages: IMessage[];
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onReply: (message: IMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
}

export function MessageList({
  messages,
  isLoading = false,
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  onReply,
  onReact,
  onDelete,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const prevMessagesLength = useRef(messages.length);

  // Scroll to bottom when new messages arrive (only if auto-scroll enabled)
  useEffect(() => {
    if (autoScroll && messages.length > prevMessagesLength.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesLength.current = messages.length;
  }, [messages, autoScroll]);

  // Track scroll position to enable/disable auto-scroll
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if user is near bottom (within 100px)
    const isNearBottom = 
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setAutoScroll(isNearBottom);

    // Check if user scrolled to top - load more messages
    if (container.scrollTop < 100 && hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Intersection Observer for infinite scroll (fallback)
  useEffect(() => {
    if (!topRef.current || !hasMore || isLoadingMore || !onLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(topRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-dark-400 text-lg">Nenhuma mensagem ainda</p>
          <p className="text-dark-500 text-sm mt-1">
            Envie uma mensagem para começar a conversa!
          </p>
        </div>
      </div>
    );
  }

  // Agrupar mensagens consecutivas do mesmo usuário
  const groupedMessages: { message: IMessage; showAvatar: boolean }[] = [];
  let lastSenderId: string | null = null;
  let lastTime: Date | null = null;

  messages.forEach((message) => {
    const messageTime = new Date(message.createdAt);
    const timeDiff = lastTime
      ? (messageTime.getTime() - lastTime.getTime()) / 1000 / 60
      : Infinity;

    // Mostrar avatar se for um novo remetente ou se passaram mais de 5 minutos
    const showAvatar = message.senderId !== lastSenderId || timeDiff > 5;

    groupedMessages.push({ message, showAvatar });

    lastSenderId = message.senderId;
    lastTime = messageTime;
  });

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto py-4 scrollbar-thin"
    >
      {/* Loading indicator at top */}
      <div ref={topRef} className="h-1" />
      {isLoadingMore && (
        <div className="flex justify-center py-4">
          <Spinner size="sm" />
          <span className="ml-2 text-dark-400 text-sm">Carregando mensagens...</span>
        </div>
      )}
      
      {hasMore && !isLoadingMore && (
        <div className="flex justify-center py-2">
          <button
            onClick={onLoadMore}
            className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
          >
            Carregar mensagens anteriores
          </button>
        </div>
      )}
      
      {groupedMessages.map(({ message, showAvatar }) => (
        <MessageItem
          key={message.id}
          message={message}
          showAvatar={showAvatar}
          onReply={onReply}
          onReact={onReact}
          onDelete={onDelete}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
