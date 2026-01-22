import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

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
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    });
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
    const group = await prisma.conversation.findFirst({
      where: {
        id,
        isGroup: true,
        ownerId: userId,
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: 'Você não tem permissão para editar este grupo' },
        { status: 403 }
      );
    }

    const updatedGroup = await prisma.conversation.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(avatar !== undefined && { avatar }),
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

    return NextResponse.json({
      id: updatedGroup.id,
      name: updatedGroup.name,
      avatar: updatedGroup.avatar,
      isGroup: updatedGroup.isGroup,
      ownerId: updatedGroup.ownerId,
      participants: updatedGroup.participants.map(p => ({
        id: p.user.id,
        nickname: p.user.nickname,
        avatar: p.user.avatar,
        publicKey: p.user.publicKey,
        status: p.user.status,
      })),
      createdAt: updatedGroup.createdAt,
      updatedAt: updatedGroup.updatedAt,
    });
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
    const group = await prisma.conversation.findFirst({
      where: {
        id,
        isGroup: true,
        ownerId: userId,
      },
    });

    if (!group) {
      return NextResponse.json(
        { error: 'Você não tem permissão para deletar este grupo' },
        { status: 403 }
      );
    }

    await prisma.conversation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao deletar grupo:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
