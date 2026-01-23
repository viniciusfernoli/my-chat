import { NextRequest, NextResponse } from 'next/server';
import { conversationService, userService } from '@/lib/db/services';

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

    const conversations = await conversationService.findByUserId(userId);

    // Formatar conversas com participantes
    const formattedConversations = await Promise.all(
      conversations.map(conv => conversationService.toApiFormat(conv, true))
    );

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
    const participant = await userService.findById(participantId);

    if (!participant) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se já existe conversa entre os dois (apenas DMs, não grupos)
    const existingConversation = await conversationService.findDM(userId, participantId);

    if (existingConversation) {
      const formatted = await conversationService.toApiFormat(existingConversation);
      return NextResponse.json(formatted);
    }

    // Criar nova conversa (DM)
    const conversation = await conversationService.create({
      isGroup: false,
      participantIds: [userId, participantId],
    });

    const formatted = await conversationService.toApiFormat(conversation);
    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Erro ao criar conversa:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
