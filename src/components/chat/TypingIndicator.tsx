'use client';

import { useChatStore } from '@/stores';
import { IConversation } from '@/types';

interface TypingIndicatorProps {
  conversation: IConversation;
  currentUserId?: string;
}

export function TypingIndicator({ conversation, currentUserId }: TypingIndicatorProps) {
  const { typingUsers } = useChatStore();
  
  const typingUserIds = typingUsers.get(conversation.id) || [];
  
  // Filtrar o próprio usuário e encontrar os nomes
  const typingParticipants = typingUserIds
    .filter(id => id !== currentUserId)
    .map(id => {
      const participant = conversation.participants.find(p => p.id === id);
      return participant?.nickname || 'Alguém';
    })
    .filter(Boolean);

  if (typingParticipants.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (typingParticipants.length === 1) {
      return `${typingParticipants[0]} está digitando`;
    } else if (typingParticipants.length === 2) {
      return `${typingParticipants[0]} e ${typingParticipants[1]} estão digitando`;
    } else if (typingParticipants.length === 3) {
      return `${typingParticipants[0]}, ${typingParticipants[1]} e ${typingParticipants[2]} estão digitando`;
    } else {
      return `${typingParticipants.slice(0, 2).join(', ')} e mais ${typingParticipants.length - 2} estão digitando`;
    }
  };

  return (
    <div className="px-4 py-2 text-sm text-dark-400 flex items-center gap-2 bg-dark-800/50">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{getTypingText()}</span>
    </div>
  );
}
