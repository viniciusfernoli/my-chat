import nacl from 'tweetnacl';
import {
  encodeBase64,
  decodeBase64,
  encodeUTF8,
  decodeUTF8,
} from 'tweetnacl-util';

/**
 * Interface para o par de chaves
 */
export interface IKeyPair {
  publicKey: string;
  secretKey: string;
}

/**
 * Interface para mensagem criptografada
 */
export interface IEncryptedMessage {
  ciphertext: string;
  nonce: string;
}

/**
 * Gera um novo par de chaves para criptografia
 */
export function generateKeyPair(): IKeyPair {
  const keyPair = nacl.box.keyPair();
  return {
    publicKey: encodeBase64(keyPair.publicKey),
    secretKey: encodeBase64(keyPair.secretKey),
  };
}

/**
 * Gera uma secret key aleatória para autenticação
 * Formato: XXXX-XXXX-XXXX-XXXX (caracteres alfanuméricos)
 */
export function generateSecretKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments: string[] = [];
  
  for (let i = 0; i < 4; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      const randomIndex = nacl.randomBytes(1)[0] % chars.length;
      segment += chars[randomIndex];
    }
    segments.push(segment);
  }
  
  return segments.join('-');
}

/**
 * Deriva uma chave a partir da secret key do usuário
 * Usado para criptografia local das chaves
 */
export function deriveKeyFromSecret(secretKey: string): Uint8Array {
  const normalized = secretKey.replace(/-/g, '').toUpperCase();
  const hash = nacl.hash(decodeUTF8(normalized));
  return hash.slice(0, nacl.secretbox.keyLength);
}

/**
 * Criptografa uma mensagem para um destinatário específico
 */
export function encryptMessage(
  message: string,
  recipientPublicKey: string,
  senderSecretKey: string
): IEncryptedMessage {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const messageUint8 = decodeUTF8(message);
  const recipientPubKey = decodeBase64(recipientPublicKey);
  const senderSecKey = decodeBase64(senderSecretKey);

  const encrypted = nacl.box(
    messageUint8,
    nonce,
    recipientPubKey,
    senderSecKey
  );

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Descriptografa uma mensagem recebida
 */
export function decryptMessage(
  encryptedMessage: IEncryptedMessage,
  senderPublicKey: string,
  recipientSecretKey: string
): string | null {
  try {
    const ciphertext = decodeBase64(encryptedMessage.ciphertext);
    const nonce = decodeBase64(encryptedMessage.nonce);
    const senderPubKey = decodeBase64(senderPublicKey);
    const recipientSecKey = decodeBase64(recipientSecretKey);

    const decrypted = nacl.box.open(
      ciphertext,
      nonce,
      senderPubKey,
      recipientSecKey
    );

    if (!decrypted) {
      return null;
    }

    return encodeUTF8(decrypted);
  } catch {
    return null;
  }
}

/**
 * Criptografa dados com uma chave simétrica (para armazenamento local)
 */
export function encryptWithSymmetricKey(
  data: string,
  key: Uint8Array
): IEncryptedMessage {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const dataUint8 = decodeUTF8(data);
  const encrypted = nacl.secretbox(dataUint8, nonce, key);

  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Descriptografa dados com uma chave simétrica
 */
export function decryptWithSymmetricKey(
  encryptedData: IEncryptedMessage,
  key: Uint8Array
): string | null {
  try {
    const ciphertext = decodeBase64(encryptedData.ciphertext);
    const nonce = decodeBase64(encryptedData.nonce);
    const decrypted = nacl.secretbox.open(ciphertext, nonce, key);

    if (!decrypted) {
      return null;
    }

    return encodeUTF8(decrypted);
  } catch {
    return null;
  }
}

/**
 * Gera um hash da mensagem para verificação de integridade
 */
export function hashMessage(message: string): string {
  const messageUint8 = decodeUTF8(message);
  const hash = nacl.hash(messageUint8);
  return encodeBase64(hash);
}

/**
 * Verifica se uma string é uma chave pública válida
 */
export function isValidPublicKey(key: string): boolean {
  try {
    const decoded = decodeBase64(key);
    return decoded.length === nacl.box.publicKeyLength;
  } catch {
    return false;
  }
}

/**
 * Verifica se uma secret key está no formato válido
 */
export function isValidSecretKeyFormat(secretKey: string): boolean {
  const pattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(secretKey.toUpperCase());
}
