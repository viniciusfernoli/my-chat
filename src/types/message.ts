import { IUser } from './user';

// Tipos de Mensagem
export interface IMessageReply {
  id: string;
  encryptedContent: string;
  nonce: string;
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
  encryptedContent: string;
  type: MessageType;
  mediaUrl?: string;
  gifUrl?: string;
  reactions: IReaction[];
  replyTo?: IMessageReply;
  replyToMessage?: IMessage;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MessageType = 'text' | 'image' | 'gif' | 'file';

// Tipos de Reação
export interface IReaction {
  id: string;
  messageId: string;
  userId: string;
  user?: IUser;
  emoji: string;
  createdAt: Date;
}

// Tipos de Conversa
export interface IConversation {
  id: string;
  participants: IUser[];
  lastMessage?: IMessage;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
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
