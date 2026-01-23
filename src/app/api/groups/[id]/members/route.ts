import { NextRequest, NextResponse } from 'next/server';
import { conversationService, userService } from '@/lib/db/services';

type RouteParams = { params: Promise<{ id: string }> };

// GET - Listar membros do grupo
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

    // Buscar participantes
    const participants = await conversationService.getParticipants(id);

    return NextResponse.json({
      members: participants.map(p => ({
        ...userService.toPublicFormat(p),
        isOwner: p.id === group.ownerId,
      })),
      ownerId: group.ownerId,
    });
  } catch (error) {
    console.error('Erro ao listar membros:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// POST - Adicionar membro ao grupo
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { memberId } = await request.json();

    if (!memberId) {
      return NextResponse.json(
        { error: 'ID do membro é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se é participante do grupo
    const group = await conversationService.findById(id);

    if (!group || !group.isGroup || !group.participantIds.includes(userId)) {
      return NextResponse.json(
        { error: 'Grupo não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o usuário já é membro
    if (group.participantIds.includes(memberId)) {
      return NextResponse.json(
        { error: 'Usuário já é membro do grupo' },
        { status: 400 }
      );
    }

    // Verificar se o usuário existe
    const newMember = await userService.findById(memberId);

    if (!newMember) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Adicionar membro
    await conversationService.addParticipant(id, memberId);

    return NextResponse.json({
      success: true,
      member: userService.toPublicFormat(newMember),
    });
  } catch (error) {
    console.error('Erro ao adicionar membro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// DELETE - Remover membro do grupo
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

    const url = new URL(request.url);
    const memberId = url.searchParams.get('memberId');

    if (!memberId) {
      return NextResponse.json(
        { error: 'ID do membro é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar grupo
    const group = await conversationService.findById(id);

    if (!group || !group.isGroup) {
      return NextResponse.json(
        { error: 'Grupo não encontrado' },
        { status: 404 }
      );
    }

    // Apenas o dono pode remover outros, ou o próprio usuário pode sair
    if (group.ownerId !== userId && memberId !== userId) {
      return NextResponse.json(
        { error: 'Você não tem permissão para remover este membro' },
        { status: 403 }
      );
    }

    // Não pode remover o dono
    if (memberId === group.ownerId) {
      return NextResponse.json(
        { error: 'Não é possível remover o dono do grupo' },
        { status: 400 }
      );
    }

    // Remover membro
    await conversationService.removeParticipant(id, memberId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover membro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
