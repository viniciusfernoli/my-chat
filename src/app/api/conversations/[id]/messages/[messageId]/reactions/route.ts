import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Adicionar reação
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { id, messageId } = await params;
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
    const { emoji } = body;

    if (!emoji) {
      return NextResponse.json(
        { error: 'Emoji é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se já existe reação
    const existingReaction = await prisma.reaction.findFirst({
      where: {
        messageId,
        userId,
        emoji,
      },
    });

    if (existingReaction) {
      // Remover reação existente
      await prisma.reaction.delete({
        where: { id: existingReaction.id },
      });

      return NextResponse.json({ removed: true });
    }

    // Adicionar nova reação
    const reaction = await prisma.reaction.create({
      data: {
        messageId,
        userId,
        emoji,
      },
      include: {
        user: {
          select: {
            id: true,
            nickname: true,
          },
        },
      },
    });

    return NextResponse.json(reaction);
  } catch (error) {
    console.error('Erro ao adicionar reação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
