import { db, COLLECTIONS, toISOString, createTimestamp, admin } from '../firebase';
import { userService } from './user-service';

// Tipos de mensagem
export type MessageType = 'text' | 'image' | 'gif' | 'file' | 'audio' | 'video';

// Interface da mensagem no Firestore
export interface FirestoreMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  replyToId: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// Interface para reação
export interface FirestoreReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: admin.firestore.Timestamp;
}

// Opções de paginação
export interface PaginationOptions {
  limit?: number;
  cursor?: string; // ID da última mensagem carregada
  direction?: 'before' | 'after'; // Carregar antes ou depois do cursor
}

// Resultado paginado
export interface PaginatedMessages {
  messages: FirestoreMessage[];
  hasMore: boolean;
  nextCursor: string | null;
}

// Serviço de Mensagens - com PAGINAÇÃO para lazy loading
export const messageService = {
  // Criar mensagem
  async create(data: {
    conversationId: string;
    senderId: string;
    content: string;
    type?: MessageType;
    replyToId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<FirestoreMessage> {
    const now = createTimestamp();
    const msgRef = db.collection(COLLECTIONS.MESSAGES).doc();
    
    const message: FirestoreMessage = {
      id: msgRef.id,
      conversationId: data.conversationId,
      senderId: data.senderId,
      content: data.content,
      type: data.type || 'text',
      replyToId: data.replyToId || null,
      isEdited: false,
      isDeleted: false,
      metadata: data.metadata || null,
      createdAt: now,
      updatedAt: now,
    };

    await msgRef.set(message);
    
    // Atualizar timestamp da conversa
    await db.collection(COLLECTIONS.CONVERSATIONS).doc(data.conversationId).update({
      updatedAt: now,
    });

    return message;
  },

  // Buscar por ID
  async findById(id: string): Promise<FirestoreMessage | null> {
    const doc = await db.collection(COLLECTIONS.MESSAGES).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as FirestoreMessage;
  },

  // Buscar mensagens com PAGINAÇÃO (para lazy loading)
  async getByConversationPaginated(
    conversationId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedMessages> {
    const { limit = 20, cursor, direction = 'before' } = options;
    
    let query = db.collection(COLLECTIONS.MESSAGES)
      .where('conversationId', '==', conversationId)
      .orderBy('createdAt', 'desc');

    // Se temos um cursor, buscar a partir dele
    if (cursor) {
      const cursorDoc = await db.collection(COLLECTIONS.MESSAGES).doc(cursor).get();
      if (cursorDoc.exists) {
        if (direction === 'before') {
          // Mensagens mais antigas que o cursor
          query = query.startAfter(cursorDoc);
        } else {
          // Mensagens mais novas que o cursor
          query = query.endBefore(cursorDoc);
        }
      }
    }

    // Buscar limit + 1 para saber se há mais
    const snapshot = await query.limit(limit + 1).get();
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreMessage));
    
    // Verificar se há mais mensagens
    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop(); // Remove a mensagem extra usada para verificar
    }

    // O próximo cursor é a última mensagem retornada
    const nextCursor = messages.length > 0 ? messages[messages.length - 1].id : null;

    return {
      messages,
      hasMore,
      nextCursor,
    };
  },

  // Buscar últimas N mensagens (sem paginação - para carga inicial)
  async getByConversation(conversationId: string, limit = 50): Promise<FirestoreMessage[]> {
    const snapshot = await db.collection(COLLECTIONS.MESSAGES)
      .where('conversationId', '==', conversationId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreMessage));
  },

  // Editar mensagem
  async update(id: string, content: string): Promise<FirestoreMessage | null> {
    await db.collection(COLLECTIONS.MESSAGES).doc(id).update({
      content,
      isEdited: true,
      updatedAt: createTimestamp(),
    });
    return this.findById(id);
  },

  // Soft delete
  async softDelete(id: string): Promise<void> {
    await db.collection(COLLECTIONS.MESSAGES).doc(id).update({
      isDeleted: true,
      content: '', // Limpar conteúdo por segurança
      updatedAt: createTimestamp(),
    });
  },

  // Hard delete
  async delete(id: string): Promise<void> {
    // Deletar reações primeiro
    const reactionsSnapshot = await db.collection(COLLECTIONS.REACTIONS)
      .where('messageId', '==', id)
      .get();
    
    const batch = db.batch();
    reactionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection(COLLECTIONS.MESSAGES).doc(id));
    await batch.commit();
  },

  // Adicionar reação
  async addReaction(messageId: string, userId: string, emoji: string): Promise<FirestoreReaction> {
    // Verificar se já existe reação do mesmo usuário com o mesmo emoji
    const existing = await db.collection(COLLECTIONS.REACTIONS)
      .where('messageId', '==', messageId)
      .where('userId', '==', userId)
      .where('emoji', '==', emoji)
      .get();

    if (!existing.empty) {
      // Retornar a existente
      const doc = existing.docs[0];
      return { id: doc.id, ...doc.data() } as FirestoreReaction;
    }

    const reactionRef = db.collection(COLLECTIONS.REACTIONS).doc();
    const reaction: FirestoreReaction = {
      id: reactionRef.id,
      messageId,
      userId,
      emoji,
      createdAt: createTimestamp(),
    };

    await reactionRef.set(reaction);
    return reaction;
  },

  // Remover reação
  async removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    const snapshot = await db.collection(COLLECTIONS.REACTIONS)
      .where('messageId', '==', messageId)
      .where('userId', '==', userId)
      .where('emoji', '==', emoji)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  },

  // Buscar reações de uma mensagem
  async getReactions(messageId: string): Promise<FirestoreReaction[]> {
    const snapshot = await db.collection(COLLECTIONS.REACTIONS)
      .where('messageId', '==', messageId)
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreReaction));
  },

  // Buscar reações de múltiplas mensagens (para batch loading)
  async getReactionsBatch(messageIds: string[]): Promise<Map<string, FirestoreReaction[]>> {
    if (messageIds.length === 0) return new Map();

    // Firestore limita 'in' queries a 30 itens
    const chunks: string[][] = [];
    for (let i = 0; i < messageIds.length; i += 30) {
      chunks.push(messageIds.slice(i, i + 30));
    }

    const allReactions: FirestoreReaction[] = [];
    for (const chunk of chunks) {
      const snapshot = await db.collection(COLLECTIONS.REACTIONS)
        .where('messageId', 'in', chunk)
        .get();
      
      snapshot.docs.forEach(doc => {
        allReactions.push({ id: doc.id, ...doc.data() } as FirestoreReaction);
      });
    }

    // Agrupar por messageId
    const grouped = new Map<string, FirestoreReaction[]>();
    for (const reaction of allReactions) {
      const existing = grouped.get(reaction.messageId) || [];
      existing.push(reaction);
      grouped.set(reaction.messageId, existing);
    }

    return grouped;
  },

  // Converter para formato da API
  async toApiFormat(message: FirestoreMessage, includeReactions = true) {
    const sender = await userService.findById(message.senderId);
    const reactions = includeReactions ? await this.getReactions(message.id) : [];
    
    let replyTo = null;
    if (message.replyToId) {
      const replyMsg = await this.findById(message.replyToId);
      if (replyMsg) {
        const replySender = await userService.findById(replyMsg.senderId);
        replyTo = {
          id: replyMsg.id,
          content: replyMsg.isDeleted ? '' : replyMsg.content,
          senderId: replyMsg.senderId,
          sender: replySender ? userService.toPublicFormat(replySender) : null,
        };
      }
    }

    // Converter reações para formato IReaction[]
    const formattedReactions = reactions.map(r => ({
      id: r.id,
      messageId: r.messageId,
      userId: r.userId,
      emoji: r.emoji,
      createdAt: toISOString(r.createdAt),
    }));

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      sender: sender ? userService.toPublicFormat(sender) : null,
      content: message.isDeleted ? '' : message.content,
      type: message.type,
      replyTo,
      isEdited: message.isEdited,
      isDeleted: message.isDeleted,
      metadata: message.metadata,
      // Extrair mediaUrl e gifUrl do metadata para compatibilidade com o frontend
      mediaUrl: message.metadata?.mediaUrl as string | undefined,
      gifUrl: message.metadata?.gifUrl as string | undefined,
      reactions: formattedReactions,
      createdAt: toISOString(message.createdAt),
      updatedAt: toISOString(message.updatedAt),
    };
  },

  // Converter batch de mensagens (mais eficiente)
  async toApiFormatBatch(messages: FirestoreMessage[]) {
    if (messages.length === 0) return [];

    // Buscar todas as reações de uma vez
    const messageIds = messages.map(m => m.id);
    const reactionsMap = await this.getReactionsBatch(messageIds);

    // Buscar todos os usuários únicos de uma vez
    const userIds = new Set<string>();
    messages.forEach(m => userIds.add(m.senderId));
    
    // Adicionar IDs de replyTo
    const replyIds = messages.filter(m => m.replyToId).map(m => m.replyToId!);
    if (replyIds.length > 0) {
      // Buscar mensagens de reply
      for (const replyId of replyIds) {
        const reply = await this.findById(replyId);
        if (reply) userIds.add(reply.senderId);
      }
    }

    // Buscar todos os usuários
    const usersMap = new Map<string, ReturnType<typeof userService.toPublicFormat>>();
    for (const userId of userIds) {
      const user = await userService.findById(userId);
      if (user) usersMap.set(userId, userService.toPublicFormat(user));
    }

    // Converter cada mensagem
    return Promise.all(messages.map(async (message) => {
      const sender = usersMap.get(message.senderId) || null;
      const reactions = reactionsMap.get(message.id) || [];

      let replyTo = null;
      if (message.replyToId) {
        const replyMsg = await this.findById(message.replyToId);
        if (replyMsg) {
          replyTo = {
            id: replyMsg.id,
            content: replyMsg.isDeleted ? '' : replyMsg.content,
            senderId: replyMsg.senderId,
            sender: usersMap.get(replyMsg.senderId) || null,
          };
        }
      }

      // Converter reações para formato IReaction[]
      const formattedReactions = reactions.map(r => ({
        id: r.id,
        messageId: r.messageId,
        userId: r.userId,
        emoji: r.emoji,
        createdAt: toISOString(r.createdAt),
      }));

      return {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        sender,
        content: message.isDeleted ? '' : message.content,
        type: message.type,
        replyTo,
        isEdited: message.isEdited,
        isDeleted: message.isDeleted,
        metadata: message.metadata,
        // Extrair mediaUrl e gifUrl do metadata para compatibilidade com o frontend
        mediaUrl: message.metadata?.mediaUrl as string | undefined,
        gifUrl: message.metadata?.gifUrl as string | undefined,
        reactions: formattedReactions,
        createdAt: toISOString(message.createdAt),
        updatedAt: toISOString(message.updatedAt),
      };
    }));
  },
};
