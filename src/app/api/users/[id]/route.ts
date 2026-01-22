import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Buscar perfil
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        status: true,
        bio: true,
        publicKey: true,
        createdAt: true,
        lastSeen: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Atualizar perfil
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id');

    if (!userId || userId !== id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { nickname, avatar, bio, status } = body;

    // Validações
    if (nickname && (nickname.length < 3 || nickname.length > 20)) {
      return NextResponse.json(
        { error: 'O apelido deve ter entre 3 e 20 caracteres' },
        { status: 400 }
      );
    }

    if (bio && bio.length > 200) {
      return NextResponse.json(
        { error: 'A bio deve ter no máximo 200 caracteres' },
        { status: 400 }
      );
    }

    // Verificar se nickname já está em uso
    if (nickname) {
      const existing = await prisma.user.findFirst({
        where: {
          nickname,
          id: { not: id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'Este apelido já está em uso' },
          { status: 409 }
        );
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(nickname && { nickname }),
        ...(avatar !== undefined && { avatar }),
        ...(bio !== undefined && { bio }),
        ...(status && { status }),
      },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        status: true,
        bio: true,
        publicKey: true,
        createdAt: true,
        lastSeen: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
