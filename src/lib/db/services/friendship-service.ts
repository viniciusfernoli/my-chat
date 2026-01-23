import { db, COLLECTIONS, toISOString, createTimestamp, admin } from '../firebase';
import { userService } from './user-service';

// Status da amizade
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked';

// Interface de Amizade no Firestore
export interface FirestoreFriendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// Serviço de Amizades
export const friendshipService = {
  // Criar solicitação de amizade
  async create(requesterId: string, addresseeId: string): Promise<FirestoreFriendship> {
    // Verificar se já existe
    const existing = await this.findBetween(requesterId, addresseeId);
    if (existing) {
      throw new Error('Solicitação de amizade já existe');
    }

    const now = createTimestamp();
    const ref = db.collection(COLLECTIONS.FRIENDSHIPS).doc();
    
    const friendship: FirestoreFriendship = {
      id: ref.id,
      requesterId,
      addresseeId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(friendship);
    return friendship;
  },

  // Buscar por ID
  async findById(id: string): Promise<FirestoreFriendship | null> {
    const doc = await db.collection(COLLECTIONS.FRIENDSHIPS).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as FirestoreFriendship;
  },

  // Buscar amizade entre dois usuários
  async findBetween(userId1: string, userId2: string): Promise<FirestoreFriendship | null> {
    // Verificar nas duas direções
    const snapshot1 = await db.collection(COLLECTIONS.FRIENDSHIPS)
      .where('requesterId', '==', userId1)
      .where('addresseeId', '==', userId2)
      .limit(1)
      .get();
    
    if (!snapshot1.empty) {
      const doc = snapshot1.docs[0];
      return { id: doc.id, ...doc.data() } as FirestoreFriendship;
    }

    const snapshot2 = await db.collection(COLLECTIONS.FRIENDSHIPS)
      .where('requesterId', '==', userId2)
      .where('addresseeId', '==', userId1)
      .limit(1)
      .get();
    
    if (!snapshot2.empty) {
      const doc = snapshot2.docs[0];
      return { id: doc.id, ...doc.data() } as FirestoreFriendship;
    }

    return null;
  },

  // Buscar amigos aceitos de um usuário
  async getFriends(userId: string): Promise<string[]> {
    const friendIds: string[] = [];

    // Buscar onde é requester
    const asRequester = await db.collection(COLLECTIONS.FRIENDSHIPS)
      .where('requesterId', '==', userId)
      .where('status', '==', 'accepted')
      .get();
    
    asRequester.docs.forEach(doc => {
      const data = doc.data();
      friendIds.push(data.addresseeId);
    });

    // Buscar onde é addressee
    const asAddressee = await db.collection(COLLECTIONS.FRIENDSHIPS)
      .where('addresseeId', '==', userId)
      .where('status', '==', 'accepted')
      .get();
    
    asAddressee.docs.forEach(doc => {
      const data = doc.data();
      friendIds.push(data.requesterId);
    });

    return friendIds;
  },

  // Buscar solicitações pendentes recebidas
  async getPendingReceived(userId: string): Promise<FirestoreFriendship[]> {
    const snapshot = await db.collection(COLLECTIONS.FRIENDSHIPS)
      .where('addresseeId', '==', userId)
      .where('status', '==', 'pending')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreFriendship));
  },

  // Buscar solicitações pendentes enviadas
  async getPendingSent(userId: string): Promise<FirestoreFriendship[]> {
    const snapshot = await db.collection(COLLECTIONS.FRIENDSHIPS)
      .where('requesterId', '==', userId)
      .where('status', '==', 'pending')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreFriendship));
  },

  // Aceitar amizade
  async accept(id: string): Promise<FirestoreFriendship | null> {
    await db.collection(COLLECTIONS.FRIENDSHIPS).doc(id).update({
      status: 'accepted',
      updatedAt: createTimestamp(),
    });
    return this.findById(id);
  },

  // Rejeitar/deletar amizade
  async delete(id: string): Promise<void> {
    await db.collection(COLLECTIONS.FRIENDSHIPS).doc(id).delete();
  },

  // Bloquear usuário
  async block(requesterId: string, addresseeId: string): Promise<FirestoreFriendship> {
    // Verificar se já existe
    let existing = await this.findBetween(requesterId, addresseeId);
    
    if (existing) {
      await db.collection(COLLECTIONS.FRIENDSHIPS).doc(existing.id).update({
        status: 'blocked',
        requesterId, // O que bloqueia se torna o requester
        addresseeId,
        updatedAt: createTimestamp(),
      });
      return this.findById(existing.id) as Promise<FirestoreFriendship>;
    }

    // Criar novo registro de bloqueio
    const now = createTimestamp();
    const ref = db.collection(COLLECTIONS.FRIENDSHIPS).doc();
    
    const friendship: FirestoreFriendship = {
      id: ref.id,
      requesterId,
      addresseeId,
      status: 'blocked',
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(friendship);
    return friendship;
  },

  // Verificar se está bloqueado
  async isBlocked(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await this.findBetween(userId1, userId2);
    return friendship?.status === 'blocked';
  },

  // Verificar se são amigos
  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const friendship = await this.findBetween(userId1, userId2);
    return friendship?.status === 'accepted';
  },

  // Converter para formato da API
  async toApiFormat(friendship: FirestoreFriendship, forUserId: string) {
    const otherUserId = friendship.requesterId === forUserId 
      ? friendship.addresseeId 
      : friendship.requesterId;
    
    const otherUser = await userService.findById(otherUserId);

    return {
      id: friendship.id,
      status: friendship.status,
      friend: otherUser ? userService.toPublicFormat(otherUser) : null,
      isRequester: friendship.requesterId === forUserId,
      createdAt: toISOString(friendship.createdAt),
      updatedAt: toISOString(friendship.updatedAt),
    };
  },
};
