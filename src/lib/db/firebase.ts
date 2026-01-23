import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Inicializar Firebase Admin SDK
function initializeFirebase() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // Carregar credenciais da variável de ambiente
  const credentialsJson = process.env.FIREBASE_CREDENTIALS;
  
  if (!credentialsJson) {
    throw new Error('Variável de ambiente FIREBASE_CREDENTIALS não definida');
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(credentialsJson);
  } catch (error) {
    throw new Error('Erro ao parsear FIREBASE_CREDENTIALS: JSON inválido');
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Inicializar app
const app = initializeFirebase();

// Exportar Firestore
export const db = getFirestore(app);

// Configurar Firestore apenas uma vez
let firestoreSettingsApplied = false;
try {
  if (!firestoreSettingsApplied) {
    db.settings({
      ignoreUndefinedProperties: true,
    });
    firestoreSettingsApplied = true;
  }
} catch (err: any) {
  if (err.message && err.message.includes('You can only call settings() once')) {
    console.warn('[Firestore] settings() já foi aplicado. Ignorando.');
  } else {
    throw err;
  }
}

// Collections
export const COLLECTIONS = {
  USERS: 'users',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  REACTIONS: 'reactions',
  FRIENDSHIPS: 'friendships',
  FRIEND_REQUESTS: 'friendRequests',
  APP_CONFIG: 'appConfig',
} as const;

// Helper para converter timestamp do Firestore para ISO string
export function toISOString(timestamp: admin.firestore.Timestamp | Date | string | null | undefined): string {
  if (!timestamp) return new Date().toISOString();
  if (typeof timestamp === 'string') return timestamp;
  if (timestamp instanceof Date) return timestamp.toISOString();
  return timestamp.toDate().toISOString();
}

// Helper para criar timestamp do Firestore
export function createTimestamp(): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.now();
}

// Helper para converter para Timestamp
export function toTimestamp(date: Date | string): admin.firestore.Timestamp {
  if (typeof date === 'string') {
    return admin.firestore.Timestamp.fromDate(new Date(date));
  }
  return admin.firestore.Timestamp.fromDate(date);
}

export { admin };
