// Serviço de notificações push
export class NotificationService {
  private static instance: NotificationService;
  private permission: NotificationPermission = 'default';
  private swRegistration: ServiceWorkerRegistration | null = null;

  private constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permission = Notification.permission;
    }
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Solicitar permissão para notificações
  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.log('Notificações não suportadas neste navegador');
      return false;
    }

    if (this.permission === 'granted') {
      return true;
    }

    if (this.permission === 'denied') {
      console.log('Permissão para notificações negada');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error);
      return false;
    }
  }

  // Registrar Service Worker
  async registerServiceWorker(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('Service Worker não suportado');
      return false;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registrado:', this.swRegistration);
      return true;
    } catch (error) {
      console.error('Erro ao registrar Service Worker:', error);
      return false;
    }
  }

  // Verificar se pode enviar notificação
  canNotify(): boolean {
    return this.permission === 'granted';
  }

  // Enviar notificação
  async notify(
    title: string,
    options?: {
      body?: string;
      icon?: string;
      badge?: string;
      tag?: string;
      data?: Record<string, unknown>;
      requireInteraction?: boolean;
      silent?: boolean;
    }
  ): Promise<void> {
    if (!this.canNotify()) {
      console.log('Não tem permissão para notificações');
      return;
    }

    const defaultOptions: NotificationOptions = {
      icon: '/favicon.ico',
      vibrate: [200, 100, 200],
      requireInteraction: false,
      ...options,
    };

    try {
      // Usar Service Worker se disponível (funciona em background)
      if (this.swRegistration) {
        await this.swRegistration.showNotification(title, defaultOptions);
      } else {
        // Fallback para Notification API direta (só funciona com página aberta)
        new Notification(title, defaultOptions);
      }
    } catch (error) {
      console.error('Erro ao enviar notificação:', error);
    }
  }

  // Notificar nova mensagem
  async notifyNewMessage(
    senderName: string,
    message: string,
    conversationId: string,
    senderAvatar?: string
  ): Promise<void> {
    const truncatedMessage = message.length > 100 
      ? message.substring(0, 100) + '...' 
      : message;

    await this.notify(`${senderName}`, {
      body: truncatedMessage,
      icon: senderAvatar || '/favicon.ico',
      tag: `message-${conversationId}`, // Agrupa notificações da mesma conversa
      data: {
        type: 'new-message',
        conversationId,
      },
      requireInteraction: false,
    });
  }

  // Verificar se documento está visível
  isDocumentVisible(): boolean {
    if (typeof document === 'undefined') return false;
    return document.visibilityState === 'visible';
  }

  // Verificar se deve notificar (baseado em status do usuário)
  shouldNotify(userStatus: string): boolean {
    // Não notificar se ocupado
    if (userStatus === 'busy') return false;
    
    // Notificar se não está visível ou se está ausente
    if (!this.isDocumentVisible()) return true;
    
    return false;
  }
}

// Singleton export
export const notificationService = NotificationService.getInstance();
