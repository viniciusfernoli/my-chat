'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Key, UserPlus, LogIn } from 'lucide-react';
import { Button, Input, Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { generateSecretKey, generateKeyPair, isValidSecretKeyFormat } from '@/lib/crypto';

type AuthMode = 'login' | 'register';

export default function AuthPage() {
  const router = useRouter();
  const { login, setLoading, isAuthenticated, hasHydrated, isLoading: authLoading } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [secretKey, setSecretKey] = useState('');
  const [nickname, setNickname] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirecionar se já está logado
  useEffect(() => {
    if (hasHydrated && !authLoading && isAuthenticated) {
      router.push('/chat');
    }
  }, [hasHydrated, authLoading, isAuthenticated, router]);

  // Mostrar loading enquanto verifica autenticação
  if (!hasHydrated || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <Spinner size="lg" />
      </div>
    );
  }

  // Se já está autenticado, não mostrar o form
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <Spinner size="lg" />
      </div>
    );
  }

  const handleGenerateKey = () => {
    const newKey = generateSecretKey();
    setGeneratedKey(newKey);
    setSecretKey(newKey);
  };

  const handleLogin = async () => {
    setError('');
    
    if (!isValidSecretKeyFormat(secretKey)) {
      setError('Formato de chave inválido. Use o formato: XXXX-XXXX-XXXX-XXXX');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretKey: secretKey.toUpperCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao fazer login');
        return;
      }

      login(data.user, data.token, data.keyPair);
      router.push('/chat');
    } catch {
      setError('Erro ao conectar com o servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    setError('');

    if (!nickname.trim()) {
      setError('Digite um apelido');
      return;
    }

    if (nickname.length < 3 || nickname.length > 20) {
      setError('O apelido deve ter entre 3 e 20 caracteres');
      return;
    }

    if (!secretKey || !isValidSecretKeyFormat(secretKey)) {
      setError('Gere uma chave secreta primeiro');
      return;
    }

    setIsSubmitting(true);

    try {
      const keyPair = generateKeyPair();

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          secretKey: secretKey.toUpperCase(),
          publicKey: keyPair.publicKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao criar conta');
        return;
      }

      login(data.user, data.token, keyPair);
      router.push('/chat');
    } catch {
      setError('Erro ao conectar com o servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-dark-800 rounded-2xl shadow-2xl p-8 border border-dark-700">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">SecureChat</h1>
        <p className="text-dark-400 mt-1">Chat com criptografia end-to-end</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-dark-900 rounded-lg p-1 mb-6">
        <button
          onClick={() => setMode('login')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === 'login'
              ? 'bg-primary-600 text-white'
              : 'text-dark-400 hover:text-white'
          }`}
        >
          <LogIn className="w-4 h-4 inline-block mr-2" />
          Entrar
        </button>
        <button
          onClick={() => setMode('register')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            mode === 'register'
              ? 'bg-primary-600 text-white'
              : 'text-dark-400 hover:text-white'
          }`}
        >
          <UserPlus className="w-4 h-4 inline-block mr-2" />
          Criar Conta
        </button>
      </div>

      {/* Forms */}
      <div className="space-y-4">
        {mode === 'register' && (
          <>
            <Input
              label="Apelido"
              placeholder="Seu nome ou apelido"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
            />

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1.5">
                Sua Chave Secreta
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value.toUpperCase())}
                  className="font-mono tracking-wider"
                  readOnly={!!generatedKey}
                />
                <Button
                  variant="secondary"
                  onClick={handleGenerateKey}
                  className="shrink-0"
                >
                  <Key className="w-4 h-4" />
                </Button>
              </div>
              {generatedKey && (
                <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-yellow-400 text-xs">
                    ⚠️ <strong>Guarde esta chave!</strong> Ela é a única forma de
                    acessar sua conta. Não há como recuperá-la.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {mode === 'login' && (
          <Input
            label="Sua Chave Secreta"
            placeholder="XXXX-XXXX-XXXX-XXXX"
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value.toUpperCase())}
            icon={<Key className="w-4 h-4" />}
            className="font-mono tracking-wider"
          />
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <Button
          className="w-full"
          onClick={mode === 'login' ? handleLogin : handleRegister}
          isLoading={isSubmitting}
        >
          {mode === 'login' ? 'Entrar' : 'Criar Conta'}
        </Button>
      </div>

      {/* Info */}
      <div className="mt-6 pt-6 border-t border-dark-700">
        <p className="text-dark-400 text-xs text-center">
          🔐 Todas as mensagens são criptografadas de ponta a ponta.
          <br />
          Nem mesmo o servidor pode ler suas mensagens.
        </p>
      </div>
    </div>
  );
}
