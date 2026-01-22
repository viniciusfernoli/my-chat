'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥'],
  'Gestos': ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤲', '🤝', '🙏', '💪'],
  'Corações': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💝', '💘', '💌'],
  'Objetos': ['🎉', '🎊', '🎁', '🎈', '✨', '🌟', '⭐', '💫', '🔥', '💯', '🏆', '🥇', '🎮', '🎯', '🎲', '🎵', '🎶', '📱', '💻', '🖥️'],
  'Comida': ['🍕', '🍔', '🍟', '🌭', '🍿', '🍩', '🍪', '🍰', '🎂', '🍫', '🍬', '🍭', '☕', '🍵', '🍺', '🍻', '🥂', '🍷', '🥤'],
  'Animais': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆'],
};

export function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<string>('Smileys');

  return (
    <div className="absolute bottom-full right-0 mb-2 w-72 bg-dark-800 rounded-xl border border-dark-700 shadow-2xl overflow-hidden animate-fade-in">
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
                onClose();
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
}
