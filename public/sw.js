// Service Worker para SecureChat
// Este arquivo deve ficar em public/sw.js

const CACHE_NAME = 'securechat-v1';
const OFFLINE_URL = '/offline.html';

// Arquivos para cachear
const urlsToCache = [
  '/',
  '/offline.html',
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('📦 Service Worker instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Cache aberto');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker ativado');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptar requisições de rede
self.addEventListener('fetch', (event) => {
  // Ignorar requisições de WebSocket e APIs
  if (
    event.request.url.includes('/api/') ||
    event.request.url.includes('socket.io') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
      .catch(() => {
        // Se for uma navegação e falhar, mostrar página offline
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      })
  );
});

// Receber notificações push
self.addEventListener('push', (event) => {
  console.log('🔔 Push recebido:', event);
  
  let data = {
    title: 'SecureChat',
    body: 'Nova mensagem',
    icon: '/favicon.ico',
    data: {},
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    vibrate: [200, 100, 200],
    data: data.data,
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Fechar' },
    ],
    requireInteraction: false,
    tag: data.tag || 'default',
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('🖱️ Notificação clicada:', event);
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Abrir ou focar a janela do chat
  const urlToOpen = event.notification.data?.conversationId 
    ? `/chat?conversation=${event.notification.data.conversationId}`
    : '/chat';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Procurar janela já aberta
        for (const client of clientList) {
          if (client.url.includes('/chat') && 'focus' in client) {
            // Enviar mensagem para a janela
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              conversationId: event.notification.data?.conversationId,
            });
            return client.focus();
          }
        }
        // Se não encontrar, abrir nova janela
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Fechar notificação
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Notificação fechada:', event);
});

// Mensagens do cliente
self.addEventListener('message', (event) => {
  console.log('📬 Mensagem do cliente:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
