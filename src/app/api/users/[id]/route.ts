import { NextRequest, NextResponse } from 'next/server';
import { userService, toISOString } from '@/lib/db/services';

// Buscar perfil
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const user = await userService.findById(id);

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(userService.toPublicFormat(user));
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Atualizar perfil
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id');

    if (!userId || userId !== id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { nickname, avatar, bio, status } = body;

    // Validações
    if (nickname && (nickname.length < 3 || nickname.length > 20)) {
      return NextResponse.json(
        { error: 'O apelido deve ter entre 3 e 20 caracteres' },
        { status: 400 }
      );
    }

    if (bio && bio.length > 200) {
      return NextResponse.json(
        { error: 'A bio deve ter no máximo 200 caracteres' },
        { status: 400 }
      );
    }

    // Verificar se nickname já está em uso (nicknames podem repetir, mas vamos verificar mesmo assim)
    // Nota: Na nova lógica, nicknames podem repetir, então removemos essa verificação

    // Preparar dados para atualização
    const updateData: Record<string, unknown> = {};
    if (nickname) updateData.nickname = nickname;
    if (avatar !== undefined) updateData.avatar = avatar;
    if (bio !== undefined) updateData.bio = bio;
    if (status) updateData.status = status;

    const updatedUser = await userService.update(id, updateData);

    if (!updatedUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(userService.toPublicFormat(updatedUser));
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
