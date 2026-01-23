import { NextRequest, NextResponse } from 'next/server';
import { userService, toISOString } from '@/lib/db/services';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    const token = request.headers.get('authorization')?.replace('Bearer ', '');

    if (!userId || !token) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Buscar usuário
    const user = await userService.findById(userId);

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Atualizar status e lastSeen
    await userService.updateStatus(userId, 'online');

    return NextResponse.json({
      ...userService.toPublicFormat(user),
      status: 'online',
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
