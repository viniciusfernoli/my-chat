import { NextRequest, NextResponse } from 'next/server';
import { conversationService, userService } from '@/lib/db/services';

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
    const group = await conversationService.create({
      name,
      isGroup: true,
      ownerId: userId,
      participantIds: allParticipantIds,
    });

    // Buscar participantes
    const formattedGroup = await conversationService.toApiFormat(group);

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

    // Buscar conversas do usuário
    const conversations = await conversationService.findByUserId(userId);
    
    // Filtrar apenas grupos
    const groups = conversations.filter(c => c.isGroup);

    // Formatar grupos
    const formattedGroups = await Promise.all(
      groups.map(group => conversationService.toApiFormat(group))
    );

    return NextResponse.json({ groups: formattedGroups });
  } catch (error) {
    console.error('Erro ao buscar grupos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
