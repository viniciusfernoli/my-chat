import { IUser } from './user';

// Tipos de Mensagem
export interface IMessageReply {
  id: string;
  content?: string;
  encryptedContent?: string;
  nonce?: string;
  senderId: string;
  senderNickname?: string;
  sender?: {
    id: string;
    nickname: string;
  };
}

export interface IMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: IUser;
  content: string;
  encryptedContent?: string;
  type: MessageType;
  mediaUrl?: string;
  gifUrl?: string;
  metadata?: Record<string, unknown>;
  reactions: IReaction[];
  replyTo?: IMessageReply;
  replyToMessage?: IMessage;
  isEdited: boolean;
  isDeleted?: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export type MessageType = 'text' | 'image' | 'gif' | 'file';

// Tipos de Reação
export interface IReaction {
  id: string;
  messageId: string;
  userId: string;
  user?: IUser;
  emoji: string;
  createdAt: string | Date;
}

// Tipos de Conversa
export interface IConversation {
  id: string;
  name?: string;         // Nome do grupo
  avatar?: string;       // Avatar do grupo
  isGroup: boolean;      // Se é grupo ou DM
  ownerId?: string;      // Dono do grupo
  participants: IUser[];
  lastMessage?: IMessage;
  unreadCount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

// Payload para envio de mensagem
export interface ISendMessagePayload {
  conversationId: string;
  content: string;
  type: MessageType;
  mediaUrl?: string;
  gifUrl?: string;
  replyTo?: string;
}

// Payload para reação
export interface IReactionPayload {
  messageId: string;
  emoji: string;
}
