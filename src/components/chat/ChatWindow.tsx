'use client';

import { useState, useCallback, useEffect } from 'react';
import { Phone, Video, MoreVertical, ArrowLeft } from 'lucide-react';
import { Avatar, Dropdown } from '@/components/ui';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { IConversation, IMessage } from '@/types';
import { useAuthStore, useChatStore } from '@/stores';
import { encryptMessage, decryptMessage, IEncryptedMessage } from '@/lib/crypto';

interface ChatWindowProps {
  conversation: IConversation;
  onBack?: () => void;
}

export function ChatWindow({ conversation, onBack }: ChatWindowProps) {
  const { user, keyPair } = useAuthStore();
  const { messages, setMessages, addMessage, onlineUsers } = useChatStore();
  const [replyTo, setReplyTo] = useState<IMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Encontrar o outro participante
  const otherParticipant = conversation.participants.find(
    (p) => p.id !== user?.id
  );
  const isOnline = otherParticipant ? onlineUsers.has(otherParticipant.id) : false;

  const conversationMessages = messages.get(conversation.id) || [];

  // Carregar mensagens
  const loadMessages = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
        headers: {
          'x-user-id': user.id,
        },
      });

      if (res.ok) {
        const data = await res.json();
        
        // Descriptografar mensagens
        const decryptedMessages = data.messages.map((msg: IMessage & { nonce: string }) => {
          if (keyPair && otherParticipant) {
            const senderPublicKey =
              msg.senderId === user.id ? user.publicKey : otherParticipant.publicKey;
            
            if (senderPublicKey) {
              const decrypted = decryptMessage(
                { ciphertext: msg.encryptedContent, nonce: msg.nonce },
                senderPublicKey,
                keyPair.secretKey
              );
              return { ...msg, content: decrypted || '[Mensagem não pode ser descriptografada]' };
            }
          }
          return { ...msg, content: msg.encryptedContent };
        });

        setMessages(conversation.id, decryptedMessages);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setIsLoading(false);
    }
  }, [conversation.id, user, keyPair, otherParticipant, setMessages]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleSendMessage = async (
    content: string,
    type: 'text' | 'gif' | 'image',
    gifUrl?: string
  ) => {
    if (!user || !keyPair || !otherParticipant) return;

    try {
      // Criptografar mensagem
      const encrypted = encryptMessage(
        content,
        otherParticipant.publicKey,
        keyPair.secretKey
      );

      const res = await fetch(`/api/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          encryptedContent: encrypted.ciphertext,
          nonce: encrypted.nonce,
          type,
          gifUrl,
          replyToId: replyTo?.id,
        }),
      });

      if (res.ok) {
        const newMessage = await res.json();
        // Adicionar mensagem descriptografada localmente
        addMessage(conversation.id, {
          ...newMessage,
          content,
          sender: {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatar,
            publicKey: user.publicKey,
          },
        });
        setReplyTo(null);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  const handleReact = async (messageId: string, emoji: string) => {
    if (!user) return;

    try {
      await fetch(
        `/api/conversations/${conversation.id}/messages/${messageId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id,
          },
          body: JSON.stringify({ emoji }),
        }
      );

      // Recarregar mensagens para atualizar reações
      loadMessages();
    } catch (error) {
      console.error('Erro ao reagir:', error);
    }
  };

  const dropdownItems = [
    {
      label: 'Ver perfil',
      onClick: () => {},
    },
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
          src={otherParticipant?.avatar}
          name={otherParticipant?.nickname}
          size="md"
          status={isOnline ? 'online' : 'offline'}
        />
        
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-white truncate">
            {otherParticipant?.nickname}
          </h2>
          <p className="text-xs text-dark-400">
            {isOnline ? 'Online' : 'Offline'}
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
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}
