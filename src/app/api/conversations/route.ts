import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Buscar conversas do usuário
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
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
                status: true,
                publicKey: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            sender: {
              select: {
                id: true,
                nickname: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    type ConversationType = typeof conversations[number];
    type ParticipantType = ConversationType['participants'][number];

    const formattedConversations = conversations.map((conv: ConversationType) => ({
      id: conv.id,
      name: conv.name,
      avatar: conv.avatar,
      isGroup: conv.isGroup,
      ownerId: conv.ownerId,
      participants: conv.participants.map((p: ParticipantType) => p.user),
      lastMessage: conv.messages[0] || null,
      unreadCount: 0,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }));

    return NextResponse.json(formattedConversations);
  } catch (error) {
    console.error('Erro ao buscar conversas:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Criar nova conversa
export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { participantId } = body;

    if (!participantId) {
      return NextResponse.json(
        { error: 'ID do participante é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se participante existe
    const participant = await prisma.user.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se já existe conversa entre os dois (apenas DMs, não grupos)
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: participantId } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                avatar: true,
                status: true,
                publicKey: true,
              },
            },
          },
        },
      },
    });

    if (existingConversation) {
      type ExistingParticipant = typeof existingConversation.participants[number];
      return NextResponse.json({
        id: existingConversation.id,
        name: existingConversation.name,
        avatar: existingConversation.avatar,
        isGroup: existingConversation.isGroup,
        ownerId: existingConversation.ownerId,
        participants: existingConversation.participants.map((p: ExistingParticipant) => p.user),
        unreadCount: 0,
        createdAt: existingConversation.createdAt,
        updatedAt: existingConversation.updatedAt,
      });
    }

    // Criar nova conversa (DM)
    const conversation = await prisma.conversation.create({
      data: {
        isGroup: false,
        participants: {
          create: [
            { userId },
            { userId: participantId },
          ],
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
                status: true,
                publicKey: true,
              },
            },
          },
        },
      },
    });

    type NewParticipant = typeof conversation.participants[number];
    return NextResponse.json({
      id: conversation.id,
      name: conversation.name,
      avatar: conversation.avatar,
      isGroup: conversation.isGroup,
      ownerId: conversation.ownerId,
      participants: conversation.participants.map((p: NewParticipant) => p.user),
      unreadCount: 0,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    });
  } catch (error) {
    console.error('Erro ao criar conversa:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
