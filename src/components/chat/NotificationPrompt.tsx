'use client';

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui';
import { notificationService } from '@/services/notification-service';

interface NotificationPromptProps {
  onPermissionGranted?: () => void;
}

export function NotificationPrompt({ onPermissionGranted }: NotificationPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [dismissCount, setDismissCount] = useState(0);

  useEffect(() => {
    // Verificar se já tem permissão ou se foi negada
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    const checkPermission = () => {
      const permission = Notification.permission;
      
      if (permission === 'granted') {
        setShowPrompt(false);
        return;
      }

      if (permission === 'denied') {
        // Se foi negada, não insistir mais
        setShowPrompt(false);
        return;
      }

      // Permissão ainda não foi decidida
      const lastDismissed = localStorage.getItem('notification-prompt-dismissed');
      const dismissedCount = parseInt(localStorage.getItem('notification-prompt-count') || '0', 10);
      
      setDismissCount(dismissedCount);

      if (lastDismissed) {
        const lastTime = new Date(lastDismissed).getTime();
        const now = Date.now();
        
        // Tempo de espera aumenta a cada dismiss (min 30s, depois 2min, 5min, 15min, 1h)
        const waitTimes = [30000, 120000, 300000, 900000, 3600000];
        const waitTime = waitTimes[Math.min(dismissedCount, waitTimes.length - 1)];
        
        if (now - lastTime < waitTime) {
          // Ainda não passou tempo suficiente
          const timeRemaining = waitTime - (now - lastTime);
          setTimeout(() => setShowPrompt(true), timeRemaining);
          return;
        }
      }

      // Mostrar prompt após 3 segundos
      setTimeout(() => setShowPrompt(true), 3000);
    };

    checkPermission();
  }, [dismissed]);

  const handleRequestPermission = async () => {
    const granted = await notificationService.requestPermission();
    
    if (granted) {
      setShowPrompt(false);
      localStorage.removeItem('notification-prompt-dismissed');
      localStorage.removeItem('notification-prompt-count');
      onPermissionGranted?.();
    } else {
      // Se foi negada pelo navegador, não insistir
      if (Notification.permission === 'denied') {
        setShowPrompt(false);
      }
    }
  };

  const handleDismiss = () => {
    const newCount = dismissCount + 1;
    setDismissCount(newCount);
    setDismissed(true);
    setShowPrompt(false);
    
    localStorage.setItem('notification-prompt-dismissed', new Date().toISOString());
    localStorage.setItem('notification-prompt-count', newCount.toString());
    
    // Re-mostrar depois de um tempo
    const waitTimes = [30000, 120000, 300000, 900000, 3600000];
    const waitTime = waitTimes[Math.min(newCount, waitTimes.length - 1)];
    
    setTimeout(() => {
      setDismissed(false);
    }, waitTime);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-dark-800 border border-dark-600 rounded-xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary-600/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-primary-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-sm">
              Ativar notificações
            </h3>
            <p className="text-dark-400 text-xs mt-1">
              Receba alertas de novas mensagens mesmo quando não estiver no chat.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleRequestPermission}
                className="text-xs"
              >
                Permitir
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                className="text-xs text-dark-400"
              >
                Agora não
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-dark-500 hover:text-dark-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
