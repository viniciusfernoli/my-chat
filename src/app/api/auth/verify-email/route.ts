import { NextRequest, NextResponse } from 'next/server';
import { userService, toISOString } from '@/lib/db/services';
import { adminAuth } from '@/lib/db/firebase';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, code, secretKey } = body;

    // Validações
    if (!userId || !code || !secretKey) {
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

    // Verificar se já está verificado
    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email já verificado' },
        { status: 400 }
      );
    }

    // Verificar código
    if (user.verificationCode !== code) {
      return NextResponse.json(
        { error: 'Código inválido' },
        { status: 400 }
      );
    }

    // Verificar expiração
    const verificationExpires = user.verificationExpires instanceof Date 
      ? user.verificationExpires 
      : user.verificationExpires?.toDate();
    
    if (verificationExpires && new Date() > verificationExpires) {
      return NextResponse.json(
        { error: 'Código expirado. Solicite um novo.' },
        { status: 400 }
      );
    }

    // Verificar secret key
    const secretKeyHash = encodeBase64(
      nacl.hash(new TextEncoder().encode(secretKey))
    );

    if (user.secretKeyHash !== secretKeyHash) {
      return NextResponse.json(
        { error: 'Chave secreta inválida' },
        { status: 401 }
      );
    }

    // Atualizar usuário como verificado
    await userService.verifyEmail(userId);
    await userService.updateStatus(userId, 'online');
    
    const updatedUser = await userService.findById(userId);

    // Gerar token
    const token = encodeBase64(nacl.randomBytes(32));

    // Gerar Custom Token do Firebase para autenticação no Realtime Database
    let firebaseToken: string | null = null;
    try {
      firebaseToken = await adminAuth.createCustomToken(updatedUser!.id, {
        username: updatedUser!.username,
        nickname: updatedUser!.nickname,
      });
    } catch (error) {
      console.error('[VerifyEmail] Erro ao gerar Firebase Custom Token:', error);
      // Não bloquear verificação se Firebase Auth falhar
    }

    // Gerar keyPair para retornar (o cliente precisa para criptografia)
    // Nota: Em produção, o cliente deveria guardar isso localmente
    const keyPair = {
      publicKey: user.publicKey,
      // A secretKey não é armazenada no servidor, o cliente precisa regenerar do secretKey
    };

    return NextResponse.json({
      user: {
        id: updatedUser!.id,
        username: updatedUser!.username,
        nickname: updatedUser!.nickname,
        email: updatedUser!.email,
        emailVerified: updatedUser!.emailVerified,
        avatar: updatedUser!.avatar,
        status: updatedUser!.status,
        bio: updatedUser!.bio,
        publicKey: updatedUser!.publicKey,
        createdAt: toISOString(updatedUser!.createdAt),
        lastSeen: toISOString(updatedUser!.lastSeen),
      },
      token,
      firebaseToken,
      keyPair,
    });
  } catch (error) {
    console.error('Erro ao verificar email:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
