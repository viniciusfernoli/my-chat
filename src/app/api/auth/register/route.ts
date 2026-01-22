import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nickname, secretKey, publicKey } = body;

    // Validações
    if (!nickname || !secretKey || !publicKey) {
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      );
    }

    if (nickname.length < 3 || nickname.length > 20) {
      return NextResponse.json(
        { error: 'O apelido deve ter entre 3 e 20 caracteres' },
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

    // Verificar se já existe usuário com mesmo nickname ou secret key
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { nickname },
          { secretKeyHash },
          { publicKey },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.nickname === nickname) {
        return NextResponse.json(
          { error: 'Este apelido já está em uso' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Esta chave já está em uso' },
        { status: 409 }
      );
    }

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        nickname,
        secretKeyHash,
        publicKey,
        status: 'online',
      },
    });

    // Gerar token simples (em produção, usar JWT)
    const token = encodeBase64(nacl.randomBytes(32));

    return NextResponse.json({
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        status: user.status,
        bio: user.bio,
        publicKey: user.publicKey,
        createdAt: user.createdAt,
        lastSeen: user.lastSeen,
      },
      token,
    });
  } catch (error) {
    console.error('Erro ao registrar:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
