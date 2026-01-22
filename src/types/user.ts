// Tipos de Usuário
export interface IUser {
  id: string;
  nickname: string;
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
  nickname: string;
  avatar?: string;
  bio?: string;
  status: UserStatus;
}

// Tipos de Autenticação
export interface IAuthCredentials {
  secretKey: string;
}

export interface IAuthSession {
  user: IUser;
  token: string;
  expiresAt: Date;
}
