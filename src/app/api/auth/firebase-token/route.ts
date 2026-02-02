import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/db/firebase';
import { userService } from '@/lib/db/services';

/**
 * API para obter um novo Firebase Custom Token.
 * Usado quando o usuário já está logado mas precisa de um token atualizado.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se usuário existe
    const user = await userService.findById(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Gerar novo Custom Token
    try {
      const firebaseToken = await adminAuth.createCustomToken(user.id, {
        username: user.username,
        nickname: user.nickname,
      });

      return NextResponse.json({ firebaseToken });
    } catch (error) {
      console.error('[Firebase Token] Erro ao gerar token:', error);
      return NextResponse.json(
        { error: 'Erro ao gerar token Firebase' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[Firebase Token] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
