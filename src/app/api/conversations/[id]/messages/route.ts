import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Buscar mensagens de uma conversa
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar se usuário é participante
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId: id,
        userId,
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { createdAt: 'desc' },
      include: {
        sender: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            publicKey: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
              },
            },
          },
        },
        replyTo: {
          select: {
            id: true,
            encryptedContent: true,
            nonce: true,
            sender: {
              select: {
                id: true,
                nickname: true,
              },
            },
          },
        },
      },
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, -1) : messages;

    return NextResponse.json({
      messages: items.reverse(),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Enviar mensagem
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar se usuário é participante
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId: id,
        userId,
      },
    });

    if (!participant) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { encryptedContent, nonce, type = 'text', mediaUrl, gifUrl, replyToId } = body;

    if (!encryptedContent || !nonce) {
      return NextResponse.json(
        { error: 'Conteúdo criptografado é obrigatório' },
        { status: 400 }
      );
    }

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: userId,
        encryptedContent,
        nonce,
        type,
        mediaUrl,
        gifUrl,
        replyToId,
      },
      include: {
        sender: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            publicKey: true,
          },
        },
        reactions: true,
        replyTo: {
          select: {
            id: true,
            encryptedContent: true,
            nonce: true,
            sender: {
              select: {
                id: true,
                nickname: true,
              },
            },
          },
        },
      },
    });

    // Atualizar data da conversa
    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
