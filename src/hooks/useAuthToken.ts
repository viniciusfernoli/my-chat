'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';

interface UseAuthTokenReturn {
  idToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  getToken: () => Promise<string | null>;
  refreshToken: () => Promise<string | null>;
}

/**
 * Hook para gerenciar o ID Token do Firebase com refresh automático.
 * Use este hook para obter um token válido para requisições autenticadas.
 */
export function useAuthToken(): UseAuthTokenReturn {
  const { 
    idToken: storeIdToken, 
    isFirebaseAuthenticated,
    getValidIdToken,
  } = useAuthStore();
  
  const [idToken, setIdToken] = useState<string | null>(storeIdToken);
  const [isLoading, setIsLoading] = useState(false);

  // Sincronizar com o store
  useEffect(() => {
    setIdToken(storeIdToken);
  }, [storeIdToken]);

  // Obter token válido (com refresh se necessário)
  const getToken = useCallback(async (): Promise<string | null> => {
    if (!isFirebaseAuthenticated) {
      return null;
    }

    setIsLoading(true);
    try {
      const validToken = await getValidIdToken();
      setIdToken(validToken);
      return validToken;
    } finally {
      setIsLoading(false);
    }
  }, [isFirebaseAuthenticated, getValidIdToken]);

  // Forçar refresh do token
  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (typeof window === 'undefined') return null;

    setIsLoading(true);
    try {
      const { getFirebaseAuthManager } = await import('@/lib/db/firebase-client');
      const authManager = getFirebaseAuthManager();
      const newToken = await authManager.getValidToken(true); // força refresh
      setIdToken(newToken);
      return newToken;
    } catch (error) {
      console.error('[useAuthToken] Erro ao forçar refresh do token:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    idToken,
    isLoading,
    isAuthenticated: isFirebaseAuthenticated,
    getToken,
    refreshToken,
  };
}

/**
 * Utilitário para criar headers de autenticação com o ID Token.
 * Use em conjunto com useAuthToken().getToken()
 */
export function createAuthHeaders(idToken: string | null, additionalHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  return headers;
}

/**
 * Hook para fazer requisições autenticadas com refresh automático de token.
 */
export function useAuthenticatedFetch() {
  const { getToken } = useAuthToken();
  const { user } = useAuthStore();

  const authenticatedFetch = useCallback(async (
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> => {
    const token = await getToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Adicionar Authorization se temos token Firebase
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Manter x-user-id para compatibilidade com APIs existentes
    if (user?.id) {
      headers['x-user-id'] = user.id;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  }, [getToken, user]);

  return authenticatedFetch;
}
