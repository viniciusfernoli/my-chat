import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

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

    const group = await prisma.conversation.findFirst({
      where: {
        id,
        isGroup: true,
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
                publicKey: true,
                status: true,
                bio: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: 'Grupo não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      members: group.participants.map(p => ({
        id: p.user.id,
        nickname: p.user.nickname,
        avatar: p.user.avatar,
        publicKey: p.user.publicKey,
        status: p.user.status,
        bio: p.user.bio,
        isOwner: p.user.id === group.ownerId,
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

    // Verificar se é o dono do grupo ou participante (pode adicionar)
    const group = await prisma.conversation.findFirst({
      where: {
        id,
        isGroup: true,
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: true,
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: 'Grupo não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se o usuário já é membro
    const existingMember = group.participants.find(p => p.userId === memberId);
    if (existingMember) {
      return NextResponse.json(
        { error: 'Usuário já é membro do grupo' },
        { status: 400 }
      );
    }

    // Verificar se o usuário existe
    const newMember = await prisma.user.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        publicKey: true,
        status: true,
      },
    });

    if (!newMember) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Adicionar membro
    await prisma.conversationParticipant.create({
      data: {
        conversationId: id,
        userId: memberId,
      },
    });

    return NextResponse.json({
      success: true,
      member: newMember,
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

    // Verificar se é o dono do grupo
    const group = await prisma.conversation.findFirst({
      where: {
        id,
        isGroup: true,
      },
    });

    if (!group) {
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
    await prisma.conversationParticipant.delete({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: memberId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao remover membro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
