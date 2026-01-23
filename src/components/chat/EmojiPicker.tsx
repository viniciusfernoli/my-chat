'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥'],
  'Gestos': ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤲', '🤝', '🙏', '💪'],
  'Corações': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💝', '💘', '💌'],
  'Objetos': ['🎉', '🎊', '🎁', '🎈', '✨', '🌟', '⭐', '💫', '🔥', '💯', '🏆', '🥇', '🎮', '🎯', '🎲', '🎵', '🎶', '📱', '💻', '🖥️'],
  'Comida': ['🍕', '🍔', '🍟', '🌭', '🍿', '🍩', '🍪', '🍰', '🎂', '🍫', '🍬', '🍭', '☕', '🍵', '🍺', '🍻', '🥂', '🍷', '🥤'],
  'Animais': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆'],
};

export function EmojiPicker({ onSelect, onClose, triggerRef }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<string>('Smileys');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (triggerRef?.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const pickerWidth = 288;
      const pickerHeight = 280;
      
      let left = rect.left;
      let top = rect.top - pickerHeight - 8;
      
      // Se não cabe acima, posiciona abaixo
      if (top < 8) {
        top = rect.bottom + 8;
      }
      
      // Se ultrapassa à direita
      if (left + pickerWidth > window.innerWidth - 8) {
        left = window.innerWidth - pickerWidth - 8;
      }
      
      // Se ultrapassa à esquerda
      if (left < 8) {
        left = 8;
      }
      
      setPosition({ top, left });
    }
  }, [triggerRef]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node) &&
          triggerRef?.current && !triggerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, triggerRef]);

  const content = (
    <div 
      ref={ref}
      style={triggerRef ? { top: position.top, left: position.left } : undefined}
      className={cn(
        "w-72 bg-dark-800 rounded-xl border border-dark-700 shadow-2xl overflow-hidden",
        triggerRef ? "fixed z-[9999]" : "absolute bottom-full right-0 mb-2"
      )}
    >
      {/* Categories */}
      <div className="flex border-b border-dark-700 overflow-x-auto scrollbar-hide">
        {Object.keys(EMOJI_CATEGORIES).map((category) => (
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
      <div className="h-48 overflow-y-auto p-2 grid grid-cols-8 gap-1">
        {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES].map(
          (emoji, index) => (
            <button
              key={index}
              onClick={() => {
                onSelect(emoji);
              }}
              className="w-8 h-8 flex items-center justify-center text-xl hover:bg-dark-700 rounded transition-colors"
            >
              {emoji}
            </button>
          )
        )}
      </div>
    </div>
  );

  // Se tem triggerRef, usa portal
  if (triggerRef) {
    return createPortal(content, document.body);
  }
  
  return content;
}
