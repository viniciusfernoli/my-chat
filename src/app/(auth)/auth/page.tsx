'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Key, UserPlus, LogIn, Mail, Lock } from 'lucide-react';
import { Button, Input, Spinner } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { generateSecretKey, generateKeyPair, isValidSecretKeyFormat } from '@/lib/crypto';

type AuthMode = 'login' | 'register' | 'verify-email' | 'forgot-key' | 'recovery-code';

export default function AuthPage() {
  const router = useRouter();
  const { login, setLoading, isAuthenticated, hasHydrated, isLoading: authLoading } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>('login');
  const [secretKey, setSecretKey] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingUserId, setPendingUserId] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newKeyGenerated, setNewKeyGenerated] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirecionar se já está logado (exceto se está mostrando nova chave)
  useEffect(() => {
    if (hasHydrated && !authLoading && isAuthenticated && !newKeyGenerated) {
      router.push('/chat');
    }
  }, [hasHydrated, authLoading, isAuthenticated, router, newKeyGenerated]);

  // Mostrar loading enquanto verifica autenticação
  if (!hasHydrated || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <Spinner size="lg" />
      </div>
    );
  }

  // Se já está autenticado e não está mostrando nova chave, não mostrar o form
  if (isAuthenticated && !newKeyGenerated) {
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

      // Regenerar keyPair (necessário para criptografia E2E)
      // Nota: Em produção, o keyPair deveria ser derivado da secretKey de forma determinística
      const keyPair = generateKeyPair();
      
      // Login com firebaseToken para autenticação no Realtime Database
      await login(data.user, data.token, keyPair, rememberMe, data.firebaseToken);
      router.push('/chat');
    } catch {
      setError('Erro ao conectar com o servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    setError('');
    setSuccess('');

    // Validar código de convite
    if (!inviteCode.trim()) {
      setError('Digite o código de convite');
      return;
    }

    // Validar nickname
    if (!nickname.trim()) {
      setError('Digite um apelido');
      return;
    }

    if (nickname.length < 2 || nickname.length > 30) {
      setError('O apelido deve ter entre 2 e 30 caracteres');
      return;
    }

    // Validar email
    if (!email.trim()) {
      setError('Digite seu email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Digite um email válido');
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
          email: email.trim().toLowerCase(),
          secretKey: secretKey.toUpperCase(),
          publicKey: keyPair.publicKey,
          inviteCode: inviteCode.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao criar conta');
        return;
      }

      // Se precisa verificar email
      if (data.requiresVerification) {
        setPendingUserId(data.userId);
        setMode('verify-email');
        setSuccess('Código de verificação enviado para seu email!');
        return;
      }

      // Login com firebaseToken (se disponível após registro)
      await login(data.user, data.token, keyPair, rememberMe, data.firebaseToken);
      router.push('/chat');
    } catch {
      setError('Erro ao conectar com o servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyEmail = async () => {
    setError('');
    setSuccess('');

    if (!verificationCode.trim() || verificationCode.length !== 6) {
      setError('Digite o código de 6 dígitos');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pendingUserId,
          code: verificationCode.trim(),
          secretKey: secretKey.toUpperCase(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao verificar email');
        return;
      }

      // Regenerar keyPair (necessário para criptografia E2E)
      const keyPair = generateKeyPair();
      
      // Login com firebaseToken para autenticação no Realtime Database
      await login(data.user, data.token, keyPair, rememberMe, data.firebaseToken);
      router.push('/chat');
    } catch {
      setError('Erro ao conectar com o servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pendingUserId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao reenviar código');
        return;
      }

      setSuccess('Novo código enviado para seu email!');
    } catch {
      setError('Erro ao conectar com o servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotKey = async () => {
    setError('');
    setSuccess('');

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      setError('Digite um email válido');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/forgot-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao solicitar recuperação');
        return;
      }

      // Se retornou userId, passa para próxima etapa
      if (data.userId) {
        setPendingUserId(data.userId);
        setMode('recovery-code');
        setSuccess('Código de recuperação enviado para seu email!');
      } else {
        setSuccess(data.message || 'Se o email estiver cadastrado, você receberá um código.');
      }
    } catch {
      setError('Erro ao conectar com o servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecoveryCode = async () => {
    setError('');
    setSuccess('');

    if (!recoveryCode.trim() || recoveryCode.length !== 6) {
      setError('Digite o código de 6 dígitos');
      return;
    }

    setIsSubmitting(true);

    try {
      // Gerar novo par de chaves
      const keyPair = generateKeyPair();

      const res = await fetch('/api/auth/reset-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pendingUserId,
          code: recoveryCode.trim(),
          publicKey: keyPair.publicKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao recuperar chave');
        return;
      }

      // Mostrar a nova chave gerada
      setNewKeyGenerated(data.newSecretKey);
      setSuccess('Nova chave gerada com sucesso!');
      
      // Fazer login automaticamente com firebaseToken
      await login(data.user, data.token, keyPair, rememberMe, data.firebaseToken);
    } catch {
      setError('Erro ao conectar com o servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueToChat = () => {
    router.push('/chat');
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

      {/* Tabs - não mostrar em modo de verificação ou recuperação */}
      {mode !== 'verify-email' && mode !== 'forgot-key' && mode !== 'recovery-code' && (
        <div className="flex bg-dark-900 rounded-lg p-1 mb-6">
          <button
            onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
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
            onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
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
      )}

      {/* Forms */}
      <div className="space-y-4">
        {mode === 'verify-email' && (
          <>
            <div className="text-center mb-4">
              <Mail className="w-12 h-12 text-primary-500 mx-auto mb-2" />
              <h2 className="text-lg font-semibold text-white">Verifique seu email</h2>
              <p className="text-dark-400 text-sm">
                Digite o código de 6 dígitos enviado para {email}
              </p>
            </div>

            <Input
              label="Código de Verificação"
              placeholder="000000"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="font-mono text-center text-2xl tracking-widest"
              maxLength={6}
            />

            <button
              onClick={handleResendCode}
              disabled={isSubmitting}
              className="text-primary-400 hover:text-primary-300 text-sm underline w-full text-center"
            >
              Reenviar código
            </button>
          </>
        )}

        {mode === 'register' && (
          <>
            <Input
              label="Código de Convite"
              placeholder="Digite o código de convite"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
            />

            <Input
              label="Apelido"
              placeholder="Seu nome ou apelido (pode ser alterado)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={30}
            />

            <Input
              label="Email"
              placeholder="seu@email.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-4 h-4" />}
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
          <>
            <Input
              label="Sua Chave Secreta"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value.toUpperCase())}
              icon={<Key className="w-4 h-4" />}
              className="font-mono tracking-wider"
            />
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-dark-600 bg-dark-700 text-primary-600 focus:ring-primary-500 focus:ring-offset-0"
              />
              <span className="text-sm text-dark-300">Lembrar de mim</span>
            </label>
          </>
        )}

        {mode === 'forgot-key' && (
          <>
            <div className="text-center mb-4">
              <Key className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
              <h2 className="text-lg font-semibold text-white">Recuperar Chave</h2>
              <p className="text-dark-400 text-sm">
                Digite o email cadastrado na sua conta
              </p>
            </div>

            <Input
              label="Email"
              placeholder="seu@email.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-4 h-4" />}
            />
          </>
        )}

        {mode === 'recovery-code' && !newKeyGenerated && (
          <>
            <div className="text-center mb-4">
              <Mail className="w-12 h-12 text-primary-500 mx-auto mb-2" />
              <h2 className="text-lg font-semibold text-white">Código de Recuperação</h2>
              <p className="text-dark-400 text-sm">
                Digite o código de 6 dígitos enviado para {email}
              </p>
            </div>

            <Input
              label="Código de Recuperação"
              placeholder="000000"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="font-mono text-center text-2xl tracking-widest"
              maxLength={6}
            />

            <button
              onClick={() => {
                setRecoveryCode('');
                setMode('forgot-key');
              }}
              disabled={isSubmitting}
              className="text-primary-400 hover:text-primary-300 text-sm underline w-full text-center"
            >
              Reenviar código
            </button>
          </>
        )}

        {mode === 'recovery-code' && newKeyGenerated && (
          <>
            <div className="text-center mb-4">
              <Key className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <h2 className="text-lg font-semibold text-white">Nova Chave Gerada!</h2>
              <p className="text-dark-400 text-sm">
                Guarde sua nova chave secreta em local seguro
              </p>
            </div>

            <div className="p-4 bg-dark-900 rounded-lg border border-dark-600">
              <p className="text-xs text-dark-400 mb-2">Sua nova chave secreta:</p>
              <p className="font-mono text-xl text-white tracking-widest text-center select-all">
                {newKeyGenerated}
              </p>
            </div>

            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 text-xs">
                ⚠️ <strong>IMPORTANTE!</strong> Anote esta chave em local seguro.
                Esta é a única forma de acessar sua conta.
              </p>
            </div>
          </>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm">{success}</p>
          </div>
        )}

        {/* Botão principal - não mostrar se nova chave foi gerada */}
        {!(mode === 'recovery-code' && newKeyGenerated) && (
          <Button
            className="w-full"
            onClick={
              mode === 'login'
                ? handleLogin
                : mode === 'verify-email'
                ? handleVerifyEmail
                : mode === 'forgot-key'
                ? handleForgotKey
                : mode === 'recovery-code'
                ? handleRecoveryCode
                : handleRegister
            }
            isLoading={isSubmitting}
          >
            {mode === 'login'
              ? 'Entrar'
              : mode === 'verify-email'
              ? 'Verificar'
              : mode === 'forgot-key'
              ? 'Enviar Código'
              : mode === 'recovery-code'
              ? 'Recuperar Chave'
              : 'Criar Conta'}
          </Button>
        )}

        {/* Botão para ir ao chat após recuperação */}
        {mode === 'recovery-code' && newKeyGenerated && (
          <Button className="w-full" onClick={handleContinueToChat}>
            Continuar para o Chat
          </Button>
        )}

        {/* Botão voltar para verify-email */}
        {mode === 'verify-email' && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setMode('register');
              setVerificationCode('');
              setPendingUserId('');
            }}
          >
            Voltar
          </Button>
        )}

        {/* Botão voltar para forgot-key e recovery-code */}
        {(mode === 'forgot-key' || (mode === 'recovery-code' && !newKeyGenerated)) && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setMode('login');
              setEmail('');
              setRecoveryCode('');
              setPendingUserId('');
              setError('');
              setSuccess('');
            }}
          >
            Voltar ao Login
          </Button>
        )}

        {/* Link para recuperar chave no modo login */}
        {mode === 'login' && (
          <button
            onClick={() => {
              setMode('forgot-key');
              setError('');
              setSuccess('');
              setSecretKey('');
            }}
            className="text-primary-400 hover:text-primary-300 text-sm underline w-full text-center mt-2"
          >
            Esqueci minha chave
          </button>
        )}
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
