'use client';

import { useState, useRef } from 'react';
import { Send, Smile, ImageIcon, Gift, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { GifPicker } from './GifPicker';
import { EmojiPicker } from './EmojiPicker';
import { IGif, IMessage } from '@/types';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  onSendMessage: (content: string, type: 'text' | 'gif' | 'image', gifUrl?: string) => void;
  onTyping?: () => void;
  replyTo?: IMessage | null;
  onCancelReply?: () => void;
  disabled?: boolean;
}

export function MessageInput({
  onSendMessage,
  onTyping,
  replyTo,
  onCancelReply,
  disabled = false,
}: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage(trimmedMessage, 'text');
      setMessage('');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    onTyping?.();
  };

  const handleGifSelect = async (gif: IGif) => {
    setShowGifPicker(false);
    setIsSending(true);
    try {
      await onSendMessage(gif.title || 'GIF', 'gif', gif.url);
    } finally {
      setIsSending(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="relative p-4 border-t border-dark-700 bg-dark-800/50">
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-dark-700 rounded-lg">
          <div className="flex-1 text-sm truncate">
            <span className="text-dark-400">Respondendo a </span>
            <span className="text-primary-400">{replyTo.sender?.nickname}</span>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Pickers */}
      {showGifPicker && (
        <GifPicker
          onSelect={handleGifSelect}
          onClose={() => setShowGifPicker(false)}
        />
      )}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={handleEmojiSelect}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        {/* Action buttons */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => {
              setShowGifPicker(!showGifPicker);
              setShowEmojiPicker(false);
            }}
            className={cn(
              'p-2 rounded-lg transition-colors',
              showGifPicker
                ? 'bg-primary-600 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-700'
            )}
            disabled={disabled}
          >
            <Gift size={20} />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowGifPicker(false);
            }}
            className={cn(
              'p-2 rounded-lg transition-colors',
              showEmojiPicker
                ? 'bg-primary-600 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-700'
            )}
            disabled={disabled}
          >
            <Smile size={20} />
          </button>
        </div>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[48px] max-h-32"
            rows={1}
            disabled={disabled}
          />
        </div>

        {/* Send button */}
        <Button
          type="submit"
          disabled={!message.trim() || isSending || disabled}
          className="shrink-0"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send size={20} />
          )}
        </Button>
      </form>
    </div>
  );
}
