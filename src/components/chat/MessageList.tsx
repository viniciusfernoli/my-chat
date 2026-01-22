'use client';

import { useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem';
import { Spinner } from '@/components/ui';
import { IMessage } from '@/types';

interface MessageListProps {
  messages: IMessage[];
  isLoading?: boolean;
  onReply: (message: IMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
}

export function MessageList({
  messages,
  isLoading = false,
  onReply,
  onReact,
  onDelete,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
