'use client';

import { ReactNode } from 'react';
import { RealtimeProvider } from '@/providers/RealtimeProvider';
import { ConnectionStatus } from '@/components/shared/ConnectionStatus';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <RealtimeProvider>
      <ConnectionStatus />
      {children}
    </RealtimeProvider>
  );
}
