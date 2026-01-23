import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/db/services';

// Buscar usuários (para adicionar amigos)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    const publicKey = url.searchParams.get('publicKey');
    const userId = request.headers.get('x-user-id');

    // Busca por publicKey (para rehydratação de auth)
    if (publicKey) {
      const user = await userService.findByPublicKey(publicKey);

      if (user) {
        return NextResponse.json([userService.toApiFormat(user)]);
      }
      return NextResponse.json([]);
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    if (!search || search.length < 2) {
      return NextResponse.json([]);
    }

    // Buscar por username ou nickname
    const users = await userService.search(search, 10);
    
    // Filtrar o próprio usuário e não verificados
    const filteredUsers = users.filter(u => u.id !== userId && u.emailVerified);

    return NextResponse.json(filteredUsers.map(u => userService.toPublicFormat(u)));
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
