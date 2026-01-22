'use client';

import { useEffect, useState, useCallback } from 'react';
import { notificationService } from '@/services/notification-service';
import { useAuthStore } from '@/stores';

export function useNotifications() {
  const { user } = useAuthStore();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isRegistered, setIsRegistered] = useState(false);

  // Verificar suporte e permissão inicial
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  // Registrar Service Worker quando usuário logar
  useEffect(() => {
    const initServiceWorker = async () => {
      if (user && isSupported) {
        const registered = await notificationService.registerServiceWorker();
        setIsRegistered(registered);
      }
    };

    initServiceWorker();
  }, [user, isSupported]);

  // Solicitar permissão
  const requestPermission = useCallback(async () => {
    const granted = await notificationService.requestPermission();
    setPermission(granted ? 'granted' : 'denied');
    return granted;
  }, []);

  // Enviar notificação de nova mensagem
  const notifyNewMessage = useCallback(
    async (senderName: string, message: string, conversationId: string, senderAvatar?: string) => {
      // Verificar se deve notificar baseado no status
      const userStatus = user?.status || 'online';
      
      if (!notificationService.shouldNotify(userStatus)) {
        return;
      }

      await notificationService.notifyNewMessage(
        senderName,
        message,
        conversationId,
        senderAvatar
      );
    },
    [user?.status]
  );

  // Enviar notificação genérica
  const notify = useCallback(
    async (title: string, options?: { body?: string; icon?: string; tag?: string }) => {
      const userStatus = user?.status || 'online';
      
      if (userStatus === 'busy') return;
      
      await notificationService.notify(title, options);
    },
    [user?.status]
  );

  return {
    isSupported,
    permission,
    isRegistered,
    canNotify: permission === 'granted',
    requestPermission,
    notifyNewMessage,
    notify,
  };
}
