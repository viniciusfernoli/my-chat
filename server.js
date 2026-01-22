const { createServer } = require('http');
const { Server } = require('socket.io');

const port = parseInt(process.env.SOCKET_PORT || '3000', 10);

// Armazenamento em memória
const onlineUsers = new Map(); // odId -> { id, nickname, avatar }
const userSockets = new Map(); // odId -> Set<socketId>
const messages = new Map(); // conversationId -> messages[]

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

io.on('connection', (socket) => {
  console.log('✅ Cliente conectado:', socket.id);

  // Usuário entra online
  socket.on('user:online', (user) => {
    if (!user?.id) return;
    
    // Armazenar usuário online
    onlineUsers.set(user.id, {
      id: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      publicKey: user.publicKey,
    });

    // Mapear socket ao usuário
    if (!userSockets.has(user.id)) {
      userSockets.set(user.id, new Set());
    }
    userSockets.get(user.id).add(socket.id);

    // Associar odId ao socket para referência
    socket.userId = user.id;

    // Notificar todos sobre usuários online
    io.emit('users:online', Array.from(onlineUsers.keys()));
    
    console.log(`👤 Usuário ${user.nickname} (${user.id}) está online`);
  });

  // Entrar em uma conversa/grupo
  socket.on('conversation:join', (conversationId) => {
    socket.join(conversationId);
    console.log(`🚪 Socket ${socket.id} entrou na conversa ${conversationId}`);
    
    // Enviar histórico de mensagens da sessão (se existir)
    const convMessages = messages.get(conversationId);
    if (convMessages && convMessages.length > 0) {
      socket.emit('conversation:history', {
        conversationId,
        messages: convMessages,
      });
    }
  });

  // Sair de uma conversa/grupo
  socket.on('conversation:leave', (conversationId) => {
    socket.leave(conversationId);
    console.log(`🚶 Socket ${socket.id} saiu da conversa ${conversationId}`);
  });

  // Enviar mensagem
  socket.on('message:send', (data) => {
    const { conversationId, message } = data;
    
    // Armazenar mensagem em memória (para histórico da sessão)
    if (!messages.has(conversationId)) {
      messages.set(conversationId, []);
    }
    messages.get(conversationId).push(message);

    // Limitar histórico em memória (últimas 100 mensagens por conversa)
    const convMessages = messages.get(conversationId);
    if (convMessages.length > 100) {
      messages.set(conversationId, convMessages.slice(-100));
    }

    // Enviar para todos na conversa (exceto remetente)
    socket.to(conversationId).emit('message:new', {
      conversationId,
      message,
    });

    console.log(`📨 Mensagem enviada na conversa ${conversationId}`);
  });

  // Usuário digitando
  socket.on('typing:start', ({ conversationId, user }) => {
    socket.to(conversationId).emit('typing:update', {
      conversationId,
      user,
      isTyping: true,
    });
  });

  socket.on('typing:stop', ({ conversationId, user }) => {
    socket.to(conversationId).emit('typing:update', {
      conversationId,
      user,
      isTyping: false,
    });
  });

  // Reação a mensagem
  socket.on('message:react', (data) => {
    const { conversationId, messageId, userId, emoji } = data;
    
    // Atualizar reação na mensagem em memória
    const convMessages = messages.get(conversationId);
    if (convMessages) {
      const msg = convMessages.find(m => m.id === messageId);
      if (msg) {
        if (!msg.reactions) msg.reactions = [];
        
        const existingIndex = msg.reactions.findIndex(
          r => r.userId === userId && r.emoji === emoji
        );
        
        if (existingIndex >= 0) {
          // Remover reação existente
          msg.reactions.splice(existingIndex, 1);
        } else {
          // Adicionar nova reação
          msg.reactions.push({
            id: `react_${Date.now()}`,
            messageId,
            userId,
            emoji,
            createdAt: new Date().toISOString(),
          });
        }
        
        // Notificar todos na conversa sobre a reação
        io.to(conversationId).emit('message:reaction', {
          conversationId,
          messageId,
          reactions: msg.reactions,
        });
      }
    }
  });

  // Desconexão
  socket.on('disconnect', () => {
    const userId = socket.userId;
    
    if (userId) {
      // Remover este socket do usuário
      const sockets = userSockets.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        
        // Se não tem mais sockets, usuário está offline
        if (sockets.size === 0) {
          userSockets.delete(userId);
          onlineUsers.delete(userId);
          
          // Notificar todos
          io.emit('users:online', Array.from(onlineUsers.keys()));
          io.emit('user:offline', userId);
          
          console.log(`👋 Usuário ${userId} está offline`);
        }
      }
    }
    
    console.log('❌ Cliente desconectado:', socket.id);
  });
});

httpServer.listen(port, '0.0.0.0', () => {
  console.log(`\n🚀 Servidor WebSocket rodando na porta ${port}`);
  console.log(`   Aguardando conexões...\n`);
});
