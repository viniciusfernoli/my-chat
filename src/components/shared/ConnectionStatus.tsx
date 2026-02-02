'use client';

import { useSocket } from '@/providers/RealtimeProvider';
import { useAuthStore } from '@/stores';
import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className = '' }: ConnectionStatusProps) {
  const { isConnected, isReconnecting } = useSocket();
  const { isFirebaseAuthenticated, isAuthenticated, user } = useAuthStore();
  const [isVisible, setIsVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [mounted, setMounted] = useState(false);

  // Evitar problemas de hidratação - só renderizar no cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // Não mostrar status se não estiver logado (não é um problema de conexão)
    if (!isAuthenticated || !user) {
      setIsVisible(false);
      return;
    }

    // Só mostrar status se estiver logado e tiver problema de conexão
    if (!isConnected || isReconnecting) {
      setIsVisible(true);
      
      if (isReconnecting) {
        setStatusMessage('Reconectando...');
      } else if (!isFirebaseAuthenticated) {
        setStatusMessage('Conectando ao servidor...');
      } else {
        setStatusMessage('Sem conexão');
      }
    } else {
      // Esconder após um breve delay quando reconectar
      const timeout = setTimeout(() => {
        setIsVisible(false);
      }, 2000);
      
      setStatusMessage('Conectado');
      
      return () => clearTimeout(timeout);
    }
  }, [isConnected, isReconnecting, isFirebaseAuthenticated, isAuthenticated, user]);

  // Não renderizar durante SSR para evitar problemas de hidratação
  if (!mounted) {
    return null;
  }

  // Não renderizar se tudo estiver OK e não for visível
  if (!isVisible && isConnected) {
    return null;
  }

  const getStatusColor = () => {
    if (isConnected) return 'bg-green-500';
    if (isReconnecting) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getIcon = () => {
    if (isConnected) {
      return <Wifi className="h-4 w-4 text-green-500" />;
    }
    if (isReconnecting) {
      return <RefreshCw className="h-4 w-4 text-yellow-500 animate-spin" />;
    }
    return <WifiOff className="h-4 w-4 text-red-500" />;
  };

  const getBgColor = () => {
    if (isConnected) return 'bg-green-500/10 border-green-500/20';
    if (isReconnecting) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  const getTextColor = () => {
    if (isConnected) return 'text-green-400';
    if (isReconnecting) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-50
        flex items-center justify-center gap-2
        py-2 px-4
        border-b
        transition-all duration-300
        ${getBgColor()}
        ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
        ${className}
      `}
    >
      {getIcon()}
      <span className={`text-sm font-medium ${getTextColor()}`}>
        {statusMessage}
      </span>
      {!isConnected && !isReconnecting && (
        <button
          onClick={() => window.location.reload()}
          className="ml-2 text-xs text-gray-400 hover:text-white underline"
        >
          Recarregar página
        </button>
      )}
    </div>
  );
}

/**
 * Componente compacto para mostrar status de conexão inline
 */
export function ConnectionStatusBadge() {
  const { isConnected, isReconnecting } = useSocket();

  if (isConnected && !isReconnecting) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5">
      {isReconnecting ? (
        <>
          <RefreshCw className="h-3 w-3 text-yellow-500 animate-spin" />
          <span className="text-xs text-yellow-500">Reconectando</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3 text-red-500" />
          <span className="text-xs text-red-500">Offline</span>
        </>
      )}
    </div>
  );
}

/**
 * Hook para usar o status de conexão em componentes
 */
export function useConnectionStatus() {
  const { isConnected, isReconnecting } = useSocket();
  const { isFirebaseAuthenticated } = useAuthStore();

  return {
    isConnected,
    isReconnecting,
    isFirebaseAuthenticated,
    isFullyConnected: isConnected && isFirebaseAuthenticated && !isReconnecting,
  };
}
