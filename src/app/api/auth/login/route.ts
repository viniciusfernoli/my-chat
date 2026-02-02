import { NextRequest, NextResponse } from 'next/server';
import { userService, toISOString } from '@/lib/db/services';
import { adminAuth } from '@/lib/db/firebase';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { secretKey } = body;

    // Validações
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Chave secreta é obrigatória' },
        { status: 400 }
      );
    }

    // Verificar formato da secret key
    const secretKeyPattern = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!secretKeyPattern.test(secretKey)) {
      return NextResponse.json(
        { error: 'Formato de chave inválido' },
        { status: 400 }
      );
    }

    // Criar hash da secret key
    const secretKeyHash = encodeBase64(
      nacl.hash(new TextEncoder().encode(secretKey))
    );

    // Buscar usuário
    const user = await userService.findBySecretKeyHash(secretKeyHash);

    if (!user) {
      return NextResponse.json(
        { error: 'Chave secreta inválida' },
        { status: 401 }
      );
    }

    // Verificar se email foi verificado
    if (!user.emailVerified) {
      return NextResponse.json(
        { 
          error: 'Email não verificado',
          requiresVerification: true,
          userId: user.id,
        },
        { status: 403 }
      );
    }

    // Atualizar status e lastSeen
    await userService.updateStatus(user.id, 'online');

    // Gerar token simples (em produção, usar JWT)
    const token = encodeBase64(nacl.randomBytes(32));

    // Gerar Custom Token do Firebase para autenticação no Realtime Database
    let firebaseToken: string | null = null;
    try {
      firebaseToken = await adminAuth.createCustomToken(user.id, {
        username: user.username,
        nickname: user.nickname,
      });
    } catch (error) {
      console.error('[Login] Erro ao gerar Firebase Custom Token:', error);
      // Não bloquear login se Firebase Auth falhar
    }

    // Nota: O keyPair precisa ser regenerado do lado do cliente
    // pois não armazenamos a chave privada no servidor
    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        email: user.email,
        emailVerified: user.emailVerified,
        avatar: user.avatar,
        status: 'online',
        bio: user.bio,
        publicKey: user.publicKey,
        createdAt: toISOString(user.createdAt),
        lastSeen: toISOString(user.lastSeen),
      },
      token,
      firebaseToken,
      // O cliente precisa derivar o keyPair da secretKey localmente
      needsKeyPairRegeneration: true,
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
