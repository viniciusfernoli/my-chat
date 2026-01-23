'use client';

import { useState, useRef, useCallback } from 'react';
import { Send, Smile, ImageIcon, Gift, X, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui';
import { GifPicker } from './GifPicker';
import { EmojiPicker } from './EmojiPicker';
import { IGif, IMessage } from '@/types';
import { cn } from '@/lib/utils';
import { ImageUploadService } from '@/services/image-upload-service';

interface MessageInputProps {
  onSendMessage: (content: string, type: 'text' | 'gif' | 'image', mediaUrl?: string) => void;
  onTyping?: () => void;
  replyTo?: IMessage | null;
  onCancelReply?: () => void;
  disabled?: boolean;
}

interface ImagePreview {
  file: File;
  preview: string;
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
  const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  const handleImageSelect = useCallback(async (file: File) => {
    setUploadError(null);
    
    // Validar arquivo
    const validation = ImageUploadService.validateFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || 'Erro ao validar imagem');
      return;
    }

    try {
      // Criar preview
      const preview = await ImageUploadService.createThumbnail(file, 300);
      setImagePreview({ file, preview });
    } catch (error) {
      console.error('Erro ao criar preview:', error);
      setUploadError('Erro ao processar imagem');
    }
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const clipboardData = e.clipboardData;
    
    // Verificar se tem imagem no clipboard
    const imageFile = await ImageUploadService.getImageFromClipboard(clipboardData);
    
    if (imageFile) {
      e.preventDefault();
      await handleImageSelect(imageFile);
    }
  }, [handleImageSelect]);

  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleImageSelect(file);
    }
    // Limpar input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  }, [handleImageSelect]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await handleImageSelect(file);
    }
  }, [handleImageSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const cancelImagePreview = useCallback(() => {
    setImagePreview(null);
    setUploadError(null);
  }, []);

  const sendImage = async () => {
    if (!imagePreview || isSending) return;

    setIsSending(true);
    setUploadError(null);

    try {
      // Upload da imagem
      const result = await ImageUploadService.upload(imagePreview.file);
      
      // Enviar mensagem com imagem
      await onSendMessage(
        message.trim() || 'Imagem',
        'image',
        result.url
      );
      
      setMessage('');
      setImagePreview(null);
    } catch (error) {
      console.error('Erro ao enviar imagem:', error);
      setUploadError(error instanceof Error ? error.message : 'Erro ao enviar imagem');
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Se tem imagem, enviar imagem
    if (imagePreview) {
      await sendImage();
      return;
    }

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
    <div 
      className="relative p-4 border-t border-dark-700 bg-dark-800/50"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileInputChange}
        className="hidden"
      />

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

      {/* Image preview */}
      {imagePreview && (
        <div className="mb-3 p-3 bg-dark-700 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-dark-600">
              <Image
                src={imagePreview.preview}
                alt="Preview"
                fill
                className="object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{imagePreview.file.name}</p>
              <p className="text-xs text-dark-400">
                {(imagePreview.file.size / 1024).toFixed(1)} KB
              </p>
              {uploadError && (
                <p className="text-xs text-red-400 mt-1">{uploadError}</p>
              )}
            </div>
            <button
              onClick={cancelImagePreview}
              className="p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-dark-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
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
          triggerRef={emojiButtonRef}
        />
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        {/* Action buttons */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg transition-colors text-dark-400 hover:text-white hover:bg-dark-700"
            disabled={disabled}
            title="Enviar imagem"
          >
            <ImageIcon size={20} />
          </button>
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
            ref={emojiButtonRef}
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
            onPaste={handlePaste}
            placeholder={imagePreview ? "Adicione uma legenda (opcional)..." : "Digite uma mensagem..."}
            className="w-full bg-dark-700 border border-dark-600 rounded-xl px-4 py-3 text-white placeholder-dark-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[48px] max-h-32"
            rows={1}
            disabled={disabled}
          />
        </div>

        {/* Send button */}
        <Button
          type="submit"
          disabled={(!message.trim() && !imagePreview) || isSending || disabled}
          className="shrink-0"
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send size={20} />
          )}
        </Button>
      </form>

      {/* Hint text */}
      <p className="text-xs text-dark-500 mt-2 text-center">
        💡 Cole uma imagem (Ctrl+V) ou arraste para enviar
      </p>
    </div>
  );
}
