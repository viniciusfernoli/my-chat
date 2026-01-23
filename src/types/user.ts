// Tipos de Usuário
export interface IUser {
  id: string;
  username: string;      // Nome de usuário imutável (para identificação)
  nickname: string;      // Apelido (pode ser alterado)
  email?: string;        // Email (apenas para o próprio usuário)
  emailVerified?: boolean;
  avatar?: string;
  status?: UserStatus;
  bio?: string;
  publicKey: string;
  createdAt?: Date | string;
  lastSeen?: Date | string;
}

export type UserStatus = 'online' | 'offline' | 'away' | 'busy';

export interface IUserProfile {
  id: string;
  username: string;
  nickname: string;
  avatar?: string;
  bio?: string;
  status: UserStatus;
}

// Tipos de Autenticação
export interface IAuthCredentials {
  secretKey: string;
}

export interface IRegisterData {
  username: string;      // Nome de usuário (imutável)
  nickname: string;      // Apelido
  email: string;         // Email para verificação
  secretKey: string;     // Chave secreta
  publicKey: string;     // Chave pública para criptografia
  inviteCode: string;    // Código de convite
}

export interface IAuthSession {
  user: IUser;
  token: string;
  expiresAt: Date;
}
