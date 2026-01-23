import { NextRequest, NextResponse } from 'next/server';
import { conversationService, toISOString } from '@/lib/db/services';

type RouteParams = { params: Promise<{ id: string }> };

// GET - Obter detalhes do grupo
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const group = await conversationService.findById(id);

    if (!group || !group.isGroup || !group.participantIds.includes(userId)) {
      return NextResponse.json(
        { error: 'Grupo não encontrado' },
        { status: 404 }
      );
    }

    const formattedGroup = await conversationService.toApiFormat(group);
    return NextResponse.json(formattedGroup);
  } catch (error) {
    console.error('Erro ao buscar grupo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// PATCH - Atualizar nome/avatar do grupo
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { name, avatar } = await request.json();

    // Verificar se é o dono do grupo
    const group = await conversationService.findById(id);

    if (!group || !group.isGroup || group.ownerId !== userId) {
      return NextResponse.json(
        { error: 'Você não tem permissão para editar este grupo' },
        { status: 403 }
      );
    }

    // Atualizar
    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (avatar !== undefined) updateData.avatar = avatar;

    const updatedGroup = await conversationService.update(id, updateData);

    if (!updatedGroup) {
      return NextResponse.json(
        { error: 'Erro ao atualizar grupo' },
        { status: 500 }
      );
    }

    const formattedGroup = await conversationService.toApiFormat(updatedGroup);
    return NextResponse.json(formattedGroup);
  } catch (error) {
    console.error('Erro ao atualizar grupo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Deletar grupo (apenas dono)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar se é o dono do grupo
    const group = await conversationService.findById(id);

    if (!group || !group.isGroup || group.ownerId !== userId) {
      return NextResponse.json(
        { error: 'Você não tem permissão para deletar este grupo' },
        { status: 403 }
      );
    }

    await conversationService.delete(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar grupo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
