import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { name, participantIds } = await request.json();

    if (!name || !participantIds || !Array.isArray(participantIds)) {
      return NextResponse.json(
        { error: 'Nome e participantes são obrigatórios' },
        { status: 400 }
      );
    }

    // Adicionar o criador aos participantes se não estiver
    const allParticipantIds = [...new Set([userId, ...participantIds])];

    // Criar o grupo
    const group = await prisma.conversation.create({
      data: {
        name,
        isGroup: true,
        ownerId: userId,
        participants: {
          create: allParticipantIds.map(id => ({
            userId: id,
          })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                avatar: true,
                publicKey: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Formatar resposta
    const formattedGroup = {
      id: group.id,
      name: group.name,
      avatar: group.avatar,
      isGroup: group.isGroup,
      ownerId: group.ownerId,
      participants: group.participants.map(p => ({
        id: p.user.id,
        nickname: p.user.nickname,
        avatar: p.user.avatar,
        publicKey: p.user.publicKey,
        status: p.user.status,
      })),
      unreadCount: 0,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };

    return NextResponse.json(formattedGroup);
  } catch (error) {
    console.error('Erro ao criar grupo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Buscar apenas grupos do usuário
    const conversations = await prisma.conversation.findMany({
      where: {
        isGroup: true,
        participants: {
          some: {
            userId,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                avatar: true,
                publicKey: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const formattedGroups = conversations.map(conv => ({
      id: conv.id,
      name: conv.name,
      avatar: conv.avatar,
      isGroup: conv.isGroup,
      ownerId: conv.ownerId,
      participants: conv.participants.map(p => ({
        id: p.user.id,
        nickname: p.user.nickname,
        avatar: p.user.avatar,
        publicKey: p.user.publicKey,
        status: p.user.status,
      })),
      unreadCount: 0,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }));

    return NextResponse.json({ groups: formattedGroups });
  } catch (error) {
    console.error('Erro ao buscar grupos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
