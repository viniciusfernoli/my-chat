'use client';

import Image from 'next/image';
import { cn, getInitials } from '@/lib/utils';

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'busy';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const statusClasses = {
  online: 'bg-green-500',
  offline: 'bg-dark-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
};

const statusSizes = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4',
};

export function Avatar({
  src,
  alt = 'Avatar',
  name,
  size = 'md',
  status,
  className,
}: AvatarProps) {
  const initials = name ? getInitials(name) : '?';

  return (
    <div className={cn('relative inline-block', className)}>
      <div
        className={cn(
          'rounded-full bg-primary-600 flex items-center justify-center font-semibold text-white overflow-hidden',
          sizeClasses[size]
        )}
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
            sizes={size === 'xl' ? '64px' : size === 'lg' ? '48px' : '40px'}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 block rounded-full ring-2 ring-dark-900',
            statusClasses[status],
            statusSizes[size]
          )}
        />
      )}
    </div>
  );
}
