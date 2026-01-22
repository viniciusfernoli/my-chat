'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Search, X, Loader2 } from 'lucide-react';
import { Input, Button } from '@/components/ui';
import { IGif } from '@/types';
import { debounce } from '@/lib/utils';

interface GifPickerProps {
  onSelect: (gif: IGif) => void;
  onClose: () => void;
}

export function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState<IGif[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchGifs = useCallback(async (query: string) => {
    setIsLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        limit: '20',
        offset: '0',
      });

      if (query) {
        params.append('search', query);
      }

      const res = await fetch(`/api/giphy?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao buscar GIFs');
      }

      setGifs(data.gifs);
    } catch (err) {
      setError('Erro ao buscar GIFs');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const debouncedFetch = useCallback(
    debounce((query: string) => fetchGifs(query), 300),
    [fetchGifs]
  );

  useEffect(() => {
    fetchGifs('');
  }, [fetchGifs]);

  useEffect(() => {
    if (search) {
      debouncedFetch(search);
    } else {
      fetchGifs('');
    }
  }, [search, debouncedFetch, fetchGifs]);

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 bg-dark-800 rounded-xl border border-dark-700 shadow-2xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-dark-700">
        <span className="text-sm font-medium text-white">GIFs</span>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Search */}
      <div className="p-3">
        <Input
          placeholder="Buscar GIFs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search size={16} />}
          className="text-sm"
        />
      </div>

      {/* GIFs Grid */}
      <div
        ref={containerRef}
        className="h-64 overflow-y-auto p-2 grid grid-cols-2 gap-2"
      >
        {isLoading && gifs.length === 0 && (
          <div className="col-span-2 flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        )}

        {error && (
          <div className="col-span-2 text-center py-8 text-dark-400 text-sm">
            {error}
          </div>
        )}

        {!isLoading && !error && gifs.length === 0 && (
          <div className="col-span-2 text-center py-8 text-dark-400 text-sm">
            Nenhum GIF encontrado
          </div>
        )}

        {gifs.map((gif) => (
          <button
            key={gif.id}
            onClick={() => onSelect(gif)}
            className="relative aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-primary-500 transition-all"
          >
            <Image
              src={gif.previewUrl}
              alt={gif.title}
              fill
              className="object-cover"
              unoptimized
            />
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-dark-700 flex items-center justify-center">
        <span className="text-xs text-dark-500">Powered by GIPHY</span>
      </div>
    </div>
  );
}
