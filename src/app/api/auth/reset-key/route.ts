import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/db/services';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

// Função para gerar nova chave secreta
function generateSecretKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = [];
  for (let i = 0; i < 4; i++) {
    let segment = '';
    for (let j = 0; j < 4; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    segments.push(segment);
  }
  return segments.join('-');
}

export async function POST(request: NextRequest) {
  try {
    console.log('[AUTH] Verificação de código de recuperação');
    const body = await request.json();
    const { userId, code, publicKey } = body;

    if (!userId || !code || !publicKey) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      );
    }

    // Buscar usuário
    const user = await userService.findById(userId);

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar código de recuperação
    if (!user.recoveryCode || !user.recoveryExpires) {
      return NextResponse.json(
        { error: 'Nenhuma solicitação de recuperação pendente' },
        { status: 400 }
      );
    }

    // Verificar se código expirou
    // recoveryExpires é um Firestore Timestamp
    const expiresAt = user.recoveryExpires.toDate ? user.recoveryExpires.toDate() : new Date(user.recoveryExpires as unknown as string);
    
    if (new Date() > expiresAt) {
      return NextResponse.json(
        { error: 'Código expirado. Solicite um novo.' },
        { status: 400 }
      );
    }

    // Verificar código
    if (user.recoveryCode !== code) {
      return NextResponse.json(
        { error: 'Código inválido' },
        { status: 400 }
      );
    }

    // Gerar nova chave secreta
    const newSecretKey = generateSecretKey();
    
    // Criar hash da nova chave
    const newSecretKeyHash = encodeBase64(
      nacl.hash(new TextEncoder().encode(newSecretKey))
    );

    // Atualizar usuário com nova chave e limpar código de recuperação
    await userService.resetKey(userId, newSecretKeyHash, publicKey);

    // Gerar token JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('[AUTH] Chave recuperada com sucesso para:', user.username);

    return NextResponse.json({
      message: 'Chave recuperada com sucesso!',
      newSecretKey, // Retornar a nova chave para o usuário salvar
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        email: user.email,
        avatar: user.avatar,
        publicKey: publicKey,
        status: user.status,
      },
      token,
      keyPair: {
        publicKey,
      },
    });
  } catch (error) {
    console.error('[AUTH] Erro ao recuperar chave:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
