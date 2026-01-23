import { db, COLLECTIONS, toISOString, createTimestamp, admin } from '../firebase';

// Interface de Configuração do App
export interface FirestoreAppConfig {
  id: string;
  key: string;
  value: string;
  description: string | null;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

// Serviço de Configuração do App
export const appConfigService = {
  // Criar ou atualizar configuração
  async set(key: string, value: string, description?: string): Promise<FirestoreAppConfig> {
    const existing = await this.get(key);
    
    if (existing) {
      await db.collection(COLLECTIONS.APP_CONFIG).doc(existing.id).update({
        value,
        description: description ?? existing.description,
        updatedAt: createTimestamp(),
      });
      return this.get(key) as Promise<FirestoreAppConfig>;
    }

    const now = createTimestamp();
    const ref = db.collection(COLLECTIONS.APP_CONFIG).doc();
    
    const config: FirestoreAppConfig = {
      id: ref.id,
      key,
      value,
      description: description || null,
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(config);
    return config;
  },

  // Buscar por chave
  async get(key: string): Promise<FirestoreAppConfig | null> {
    const snapshot = await db.collection(COLLECTIONS.APP_CONFIG)
      .where('key', '==', key)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as FirestoreAppConfig;
  },

  // Buscar valor por chave (retorna apenas a string)
  async getValue(key: string): Promise<string | null> {
    const config = await this.get(key);
    return config?.value || null;
  },

  // Listar todas as configurações
  async getAll(): Promise<FirestoreAppConfig[]> {
    const snapshot = await db.collection(COLLECTIONS.APP_CONFIG).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FirestoreAppConfig));
  },

  // Deletar configuração
  async delete(key: string): Promise<void> {
    const config = await this.get(key);
    if (config) {
      await db.collection(COLLECTIONS.APP_CONFIG).doc(config.id).delete();
    }
  },

  // Configurações específicas do app

  // Código de convite
  async getInviteCode(): Promise<string | null> {
    return this.getValue('INVITE_CODE');
  },

  async setInviteCode(code: string): Promise<void> {
    await this.set('INVITE_CODE', code, 'Código de convite para criação de contas');
  },

  // Verificar se convite está habilitado
  async isInviteRequired(): Promise<boolean> {
    const value = await this.getValue('REQUIRE_INVITE');
    return value === 'true';
  },

  async setInviteRequired(required: boolean): Promise<void> {
    await this.set('REQUIRE_INVITE', required ? 'true' : 'false', 'Se é necessário código de convite para criar conta');
  },

  // Verificação de email
  async isEmailVerificationRequired(): Promise<boolean> {
    const value = await this.getValue('REQUIRE_EMAIL_VERIFICATION');
    return value === 'true';
  },

  async setEmailVerificationRequired(required: boolean): Promise<void> {
    await this.set('REQUIRE_EMAIL_VERIFICATION', required ? 'true' : 'false', 'Se é necessário verificar email');
  },

  // Converter para formato da API
  toApiFormat(config: FirestoreAppConfig) {
    return {
      id: config.id,
      key: config.key,
      value: config.value,
      description: config.description,
      createdAt: toISOString(config.createdAt),
      updatedAt: toISOString(config.updatedAt),
    };
  },
};
