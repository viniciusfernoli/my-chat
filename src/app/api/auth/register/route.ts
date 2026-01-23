import { NextRequest, NextResponse } from 'next/server';
import { userService, appConfigService } from '@/lib/db/services';
import { sendVerificationEmail } from '@/services/email-service';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

// Função para gerar código de verificação de 6 dígitos
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Função para extrair username do email
function extractUsernameFromEmail(email: string): string {
  const localPart = email.split('@')[0];
  // Remover caracteres especiais, manter apenas letras, números e underscore
  const sanitized = localPart.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  // Garantir que tenha entre 3 e 20 caracteres
  const trimmed = sanitized.slice(0, 20);
  // Se for menor que 3, adicionar sufixo
  if (trimmed.length < 3) {
    return trimmed.padEnd(3, '0');
  }
  return trimmed;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[AUTH] Registro iniciado');
    const body = await request.json();
    console.log('[AUTH] Dados recebidos:', body);
    const { nickname, email, secretKey, publicKey, inviteCode } = body;

    // Validações básicas
    if (!nickname || !email || !secretKey || !publicKey || !inviteCode) {
      console.warn('[AUTH] Dados incompletos:', body);
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      );
    }

    // Validar código de convite
    const storedInviteCode = await appConfigService.getInviteCode();

    if (!storedInviteCode || storedInviteCode !== inviteCode) {
      console.warn('[AUTH] Código de convite inválido:', inviteCode);
      return NextResponse.json(
        { error: 'Código de convite inválido' },
        { status: 403 }
      );
    }

    // Validar nickname
    if (nickname.length < 2 || nickname.length > 30) {
      console.warn('[AUTH] Apelido inválido:', nickname);
      return NextResponse.json(
        { error: 'O apelido deve ter entre 2 e 30 caracteres' },
        { status: 400 }
      );
    }

    // Validar email
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      console.warn('[AUTH] Email inválido:', email);
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Verificar formato da secret key
    const secretKeyPattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!secretKeyPattern.test(secretKey)) {
      console.warn('[AUTH] Chave secreta inválida:', secretKey);
      return NextResponse.json(
        { error: 'Formato de chave inválido' },
        { status: 400 }
      );
    }

    // Criar hash da secret key
    const secretKeyHash = encodeBase64(
      nacl.hash(new TextEncoder().encode(secretKey))
    );

    // Gerar username a partir do email
    const baseUsername = extractUsernameFromEmail(email);
    let username = baseUsername;
    let counter = 1;

    // Verificar se já existe usuário com username e adicionar sufixo se necessário
    while (await userService.findByUsername(username)) {
      console.warn('[AUTH] Username já existe, tentando sufixo:', username);
      username = `${baseUsername.slice(0, 17)}${counter}`.slice(0, 20);
      counter++;
      if (counter > 99) {
        console.error('[AUTH] Não foi possível gerar um nome de usuário único. Email:', email);
        return NextResponse.json(
          { error: 'Não foi possível gerar um nome de usuário único. Tente com outro email.' },
          { status: 409 }
        );
      }
    }

    // Verificar se já existe usuário com email
    const existingByEmail = await userService.findByEmail(email);
    if (existingByEmail) {
      console.warn('[AUTH] Email já está em uso:', email);
      return NextResponse.json(
        { error: 'Este email já está em uso' },
        { status: 409 }
      );
    }

    // Verificar se já existe usuário com secretKeyHash
    const existingByKey = await userService.findBySecretKeyHash(secretKeyHash);
    if (existingByKey) {
      console.warn('[AUTH] Chave secreta já está em uso:', secretKey);
      return NextResponse.json(
        { error: 'Esta chave já está em uso' },
        { status: 409 }
      );
    }

    // Verificar se já existe usuário com publicKey
    const existingByPublicKey = await userService.findByPublicKey(publicKey);
    if (existingByPublicKey) {
      console.warn('[AUTH] Chave pública já está em uso:', publicKey);
      return NextResponse.json(
        { error: 'Esta chave pública já está em uso' },
        { status: 409 }
      );
    }

    // Gerar código de verificação
    const verificationCode = generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Criar usuário (não verificado)
    console.log('[AUTH] Criando usuário:', { username, nickname, email });
    const user = await userService.create({
      username,
      nickname,
      email,
      secretKeyHash,
      publicKey,
      verificationCode,
      verificationExpires,
    });

    // Enviar email de verificação
    console.log('[AUTH] Enviando email de verificação...');
    const emailSent = await sendVerificationEmail(email, verificationCode, nickname);

    if (!emailSent) {
      console.error('[AUTH] Falha ao enviar email de verificação. Deletando usuário:', user.id);
      await userService.delete(user.id);
      return NextResponse.json(
        { error: 'Erro ao enviar email de verificação' },
        { status: 500 }
      );
    }

    console.log('[AUTH] Registro finalizado com sucesso:', user.id);
    return NextResponse.json({
      requiresVerification: true,
      userId: user.id,
      message: 'Conta criada! Verifique seu email para ativar.',
    });
  } catch (error) {
    console.error('[AUTH] Erro ao registrar:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
