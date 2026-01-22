'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

type UserStatus = 'online' | 'away' | 'busy' | 'offline';

interface StatusOption {
  value: UserStatus;
  label: string;
  color: string;
  description: string;
}

const statusOptions: StatusOption[] = [
  { value: 'online', label: 'Online', color: 'bg-green-500', description: 'Disponível' },
  { value: 'away', label: 'Ausente', color: 'bg-yellow-500', description: 'Volto logo' },
  { value: 'busy', label: 'Ocupado', color: 'bg-red-500', description: 'Não perturbe' },
  { value: 'offline', label: 'Invisível', color: 'bg-dark-500', description: 'Parecer offline' },
];

interface StatusSelectorProps {
  currentStatus: UserStatus;
  onStatusChange: (status: UserStatus) => void;
  className?: string;
}

export function StatusSelector({ currentStatus, onStatusChange, className }: StatusSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = statusOptions.find(opt => opt.value === currentStatus) || statusOptions[0];

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusSelect = (status: UserStatus) => {
    onStatusChange(status);
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-2 py-1 rounded-lg',
          'hover:bg-dark-700 transition-colors',
          'text-sm'
        )}
      >
        <span className={cn('w-2.5 h-2.5 rounded-full', currentOption.color)} />
        <span className="text-dark-300">{currentOption.label}</span>
        <ChevronDown 
          size={14} 
          className={cn(
            'text-dark-400 transition-transform',
            isOpen && 'rotate-180'
          )} 
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-48 bg-dark-800 border border-dark-600 rounded-lg shadow-lg z-50 overflow-hidden">
          {statusOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleStatusSelect(option.value)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2',
                'hover:bg-dark-700 transition-colors text-left',
                currentStatus === option.value && 'bg-dark-700'
              )}
            >
              <span className={cn('w-3 h-3 rounded-full', option.color)} />
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{option.label}</p>
                <p className="text-dark-400 text-xs">{option.description}</p>
              </div>
              {currentStatus === option.value && (
                <Circle size={8} className="text-primary-500 fill-primary-500" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
