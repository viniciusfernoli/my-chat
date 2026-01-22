'use client';

import { ReactNode } from 'react';
import { SocketProvider } from '@/providers/SocketProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SocketProvider>
      {children}
    </SocketProvider>
  );
}
