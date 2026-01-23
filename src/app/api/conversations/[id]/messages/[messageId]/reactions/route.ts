import { NextRequest, NextResponse } from 'next/server';
import { conversationService, messageService, userService } from '@/lib/db/services';

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
    const conversation = await conversationService.findById(id);
    
    if (!conversation || !conversation.participantIds.includes(userId)) {
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
    const existingReactions = await messageService.getReactions(messageId);
    const existingReaction = existingReactions.find(
      r => r.userId === userId && r.emoji === emoji
    );

    if (existingReaction) {
      // Remover reação existente
      await messageService.removeReaction(messageId, userId, emoji);
      return NextResponse.json({ removed: true });
    }

    // Adicionar nova reação
    const reaction = await messageService.addReaction(messageId, userId, emoji);
    const user = await userService.findById(userId);

    return NextResponse.json({
      id: reaction.id,
      messageId: reaction.messageId,
      userId: reaction.userId,
      emoji: reaction.emoji,
      user: user ? { id: user.id, nickname: user.nickname } : null,
    });
  } catch (error) {
    console.error('Erro ao adicionar reação:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
