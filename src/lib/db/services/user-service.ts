import { db, COLLECTIONS, toISOString, createTimestamp, admin } from '../firebase';

// Interface do usuário no Firestore
export interface FirestoreUser {
  id: string;
  username: string | null;
  nickname: string;
  email: string | null;
  emailVerified: boolean;
  verificationCode: string | null;
  verificationExpires: admin.firestore.Timestamp | null;
  recoveryCode: string | null;
  recoveryExpires: admin.firestore.Timestamp | null;
  avatar: string | null;
  bio: string | null;
  status: string;
  publicKey: string;
  secretKeyHash: string;
  createdAt: admin.firestore.Timestamp;
  lastSeen: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// Serviço de Usuários
export const userService = {
  // Criar usuário
  async create(data: {
    username: string;
    nickname: string;
    email: string;
    publicKey: string;
    secretKeyHash: string;
    verificationCode: string;
    verificationExpires?: Date;
  }): Promise<FirestoreUser> {
    const now = createTimestamp();

    const verificationExpires = data.verificationExpires
      ? admin.firestore.Timestamp.fromDate(data.verificationExpires)
      : admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)); // 15 minutos

    const userRef = db.collection(COLLECTIONS.USERS).doc();
    const user: FirestoreUser = {
      id: userRef.id,
      username: data.username.toLowerCase(),
      nickname: data.nickname,
      email: data.email.toLowerCase(),
      emailVerified: false,
      verificationCode: data.verificationCode,
      verificationExpires,
      recoveryCode: null,
      recoveryExpires: null,
      avatar: null,
      bio: null,
      status: 'offline',
      publicKey: data.publicKey,
      secretKeyHash: data.secretKeyHash,
      createdAt: now,
      lastSeen: now,
      updatedAt: now,
    };

    await userRef.set(user);
    return user;
  },

  // Buscar por ID
  async findById(id: string): Promise<FirestoreUser | null> {
    const doc = await db.collection(COLLECTIONS.USERS).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as FirestoreUser;
  },

  // Buscar por secretKeyHash
  async findBySecretKeyHash(secretKeyHash: string): Promise<FirestoreUser | null> {
    const snapshot = await db.collection(COLLECTIONS.USERS)
      .where('secretKeyHash', '==', secretKeyHash)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as FirestoreUser;
  },

  // Buscar por username
  async findByUsername(username: string): Promise<FirestoreUser | null> {
    const snapshot = await db.collection(COLLECTIONS.USERS)
      .where('username', '==', username.toLowerCase())
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as FirestoreUser;
  },

  // Buscar por email
  async findByEmail(email: string): Promise<FirestoreUser | null> {
    const snapshot = await db.collection(COLLECTIONS.USERS)
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as FirestoreUser;
  },

  // Buscar por publicKey
  async findByPublicKey(publicKey: string): Promise<FirestoreUser | null> {
    const snapshot = await db.collection(COLLECTIONS.USERS)
      .where('publicKey', '==', publicKey)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as FirestoreUser;
  },

  // Buscar usuários (pesquisa)
  async search(query: string, limit = 10): Promise<FirestoreUser[]> {
    // Firestore não suporta LIKE, então fazemos busca por prefixo
    const queryLower = query.toLowerCase();
    
    // Buscar por username
    const usernameSnapshot = await db.collection(COLLECTIONS.USERS)
      .where('username', '>=', queryLower)
      .where('username', '<=', queryLower + '\uf8ff')
      .where('emailVerified', '==', true)
      .limit(limit)
      .get();
    
    // Buscar por nickname (normalizado)
    const nicknameSnapshot = await db.collection(COLLECTIONS.USERS)
      .where('emailVerified', '==', true)
      .limit(50) // Pegar mais para filtrar
      .get();
    
    const usersMap = new Map<string, FirestoreUser>();
    
    usernameSnapshot.docs.forEach(doc => {
      usersMap.set(doc.id, { id: doc.id, ...doc.data() } as FirestoreUser);
    });
    
    // Filtrar nickname manualmente (case-insensitive contains)
    nicknameSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.nickname?.toLowerCase().includes(queryLower) &&
          !usersMap.has(doc.id)) {
        usersMap.set(doc.id, { id: doc.id, ...data } as FirestoreUser);
      }
    });
    
    return Array.from(usersMap.values()).slice(0, limit);
  },

  // Deletar usuário
  async delete(id: string): Promise<void> {
    await db.collection(COLLECTIONS.USERS).doc(id).delete();
  },

  // Atualizar usuário
  async update(id: string, data: Partial<FirestoreUser>): Promise<FirestoreUser | null> {
    const userRef = db.collection(COLLECTIONS.USERS).doc(id);
    await userRef.update({
      ...data,
      updatedAt: createTimestamp(),
    });
    return this.findById(id);
  },

  // Verificar email
  async verifyEmail(id: string): Promise<FirestoreUser | null> {
    return this.update(id, {
      emailVerified: true,
      verificationCode: null,
      verificationExpires: null,
      status: 'online',
    });
  },

  // Atualizar código de verificação
  async updateVerificationCode(id: string, code: string, expires?: Date): Promise<void> {
    const verificationExpires = expires 
      ? admin.firestore.Timestamp.fromDate(expires)
      : admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000));
    
    await db.collection(COLLECTIONS.USERS).doc(id).update({
      verificationCode: code,
      verificationExpires,
      updatedAt: createTimestamp(),
    });
  },

  // Atualizar status e lastSeen
  async updateStatus(id: string, status: string): Promise<void> {
    await db.collection(COLLECTIONS.USERS).doc(id).update({
      status,
      lastSeen: createTimestamp(),
      updatedAt: createTimestamp(),
    });
  },

  // Definir código de recuperação de chave
  async setRecoveryCode(id: string, code: string, expires?: Date): Promise<void> {
    const recoveryExpires = expires
      ? admin.firestore.Timestamp.fromDate(expires)
      : admin.firestore.Timestamp.fromDate(new Date(Date.now() + 15 * 60 * 1000)); // 15 minutos

    await db.collection(COLLECTIONS.USERS).doc(id).update({
      recoveryCode: code,
      recoveryExpires,
      updatedAt: createTimestamp(),
    });
  },

  // Resetar chave do usuário (gerar nova chave)
  async resetKey(id: string, secretKeyHash: string, publicKey: string): Promise<FirestoreUser | null> {
    await db.collection(COLLECTIONS.USERS).doc(id).update({
      secretKeyHash,
      publicKey,
      recoveryCode: null,
      recoveryExpires: null,
      updatedAt: createTimestamp(),
    });
    return this.findById(id);
  },

  // Converter para formato da API
  toApiFormat(user: FirestoreUser) {
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      email: user.email,
      emailVerified: user.emailVerified,
      avatar: user.avatar,
      bio: user.bio,
      status: user.status,
      publicKey: user.publicKey,
      createdAt: toISOString(user.createdAt),
      lastSeen: toISOString(user.lastSeen),
    };
  },

  // Formato público (sem email)
  toPublicFormat(user: FirestoreUser) {
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      bio: user.bio,
      status: user.status,
      publicKey: user.publicKey,
    };
  },
};
