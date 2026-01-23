import { db, COLLECTIONS, toISOString, createTimestamp, admin } from '../firebase';
import { userService, FirestoreUser } from './user-service';

// Interface da conversa no Firestore
export interface FirestoreConversation {
  id: string;
  name: string | null;
  avatar: string | null;
  isGroup: boolean;
  ownerId: string | null;
  participantIds: string[]; // Array de IDs de usuários
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// Serviço de Conversas
export const conversationService = {
  // Criar conversa
  async create(data: {
    name?: string;
    avatar?: string;
    isGroup: boolean;
    ownerId?: string;
    participantIds: string[];
  }): Promise<FirestoreConversation> {
    const now = createTimestamp();
    const convRef = db.collection(COLLECTIONS.CONVERSATIONS).doc();
    
    const conversation: FirestoreConversation = {
      id: convRef.id,
      name: data.name || null,
      avatar: data.avatar || null,
      isGroup: data.isGroup,
      ownerId: data.ownerId || null,
      participantIds: data.participantIds,
      createdAt: now,
      updatedAt: now,
    };

    await convRef.set(conversation);
    return conversation;
  },

  // Buscar por ID
  async findById(id: string): Promise<FirestoreConversation | null> {
    const doc = await db.collection(COLLECTIONS.CONVERSATIONS).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as FirestoreConversation;
  },

  // Buscar conversas do usuário
  async findByUserId(userId: string): Promise<FirestoreConversation[]> {
    const snapshot = await db.collection(COLLECTIONS.CONVERSATIONS)
      .where('participantIds', 'array-contains', userId)
      .orderBy('updatedAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreConversation));
  },

  // Buscar DM entre dois usuários
  async findDM(userId1: string, userId2: string): Promise<FirestoreConversation | null> {
    const snapshot = await db.collection(COLLECTIONS.CONVERSATIONS)
      .where('isGroup', '==', false)
      .where('participantIds', 'array-contains', userId1)
      .get();
    
    // Filtrar para encontrar a conversa que também contém userId2
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.participantIds.includes(userId2) && data.participantIds.length === 2) {
        return { id: doc.id, ...data } as FirestoreConversation;
      }
    }
    
    return null;
  },

  // Atualizar conversa
  async update(id: string, data: Partial<FirestoreConversation>): Promise<FirestoreConversation | null> {
    const convRef = db.collection(COLLECTIONS.CONVERSATIONS).doc(id);
    await convRef.update({
      ...data,
      updatedAt: createTimestamp(),
    });
    return this.findById(id);
  },

  // Adicionar participante
  async addParticipant(id: string, userId: string): Promise<void> {
    await db.collection(COLLECTIONS.CONVERSATIONS).doc(id).update({
      participantIds: admin.firestore.FieldValue.arrayUnion(userId),
      updatedAt: createTimestamp(),
    });
  },

  // Remover participante
  async removeParticipant(id: string, userId: string): Promise<void> {
    await db.collection(COLLECTIONS.CONVERSATIONS).doc(id).update({
      participantIds: admin.firestore.FieldValue.arrayRemove(userId),
      updatedAt: createTimestamp(),
    });
  },

  // Touch - atualizar updatedAt (para ordenação)
  async touch(id: string): Promise<void> {
    await db.collection(COLLECTIONS.CONVERSATIONS).doc(id).update({
      updatedAt: createTimestamp(),
    });
  },

  // Deletar conversa
  async delete(id: string): Promise<void> {
    // Deletar todas as mensagens da conversa
    const messagesSnapshot = await db.collection(COLLECTIONS.MESSAGES)
      .where('conversationId', '==', id)
      .get();
    
    const batch = db.batch();
    messagesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection(COLLECTIONS.CONVERSATIONS).doc(id));
    await batch.commit();
  },

  // Buscar participantes com dados completos
  async getParticipants(conversationId: string): Promise<FirestoreUser[]> {
    const conv = await this.findById(conversationId);
    if (!conv) return [];
    
    const users: FirestoreUser[] = [];
    for (const id of conv.participantIds) {
      const user = await userService.findById(id);
      if (user) users.push(user);
    }
    return users;
  },

  // Converter para formato da API (com participantes)
  async toApiFormat(conversation: FirestoreConversation, includeLastMessage = false) {
    const participants = await this.getParticipants(conversation.id);
    
    let lastMessage = null;
    if (includeLastMessage) {
      const { messageService } = await import('./message-service');
      const messages = await messageService.getByConversation(conversation.id, 1);
      lastMessage = messages[0] || null;
    }
    
    return {
      id: conversation.id,
      name: conversation.name,
      avatar: conversation.avatar,
      isGroup: conversation.isGroup,
      ownerId: conversation.ownerId,
      participants: participants.map(p => userService.toPublicFormat(p)),
      lastMessage: lastMessage ? {
        id: lastMessage.id,
        content: lastMessage.content,
        senderId: lastMessage.senderId,
        createdAt: toISOString(lastMessage.createdAt),
      } : null,
      unreadCount: 0, // TODO: implementar contagem de não lidas
      createdAt: toISOString(conversation.createdAt),
      updatedAt: toISOString(conversation.updatedAt),
    };
  },
};
