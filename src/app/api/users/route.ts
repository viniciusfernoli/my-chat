import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Buscar usuários (para adicionar amigos)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    const publicKey = url.searchParams.get('publicKey');
    const userId = request.headers.get('x-user-id');

    // Busca por publicKey (para rehydratação de auth)
    if (publicKey) {
      const user = await prisma.user.findUnique({
        where: { publicKey },
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

      if (user) {
        return NextResponse.json([user]);
      }
      return NextResponse.json([]);
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    if (!search || search.length < 2) {
      return NextResponse.json([]);
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } },
          {
            nickname: {
              contains: search,
              mode: 'insensitive',
            },
          },
        ],
      },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        status: true,
        bio: true,
      },
      take: 10,
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
