import { NextRequest, NextResponse } from 'next/server';
import { appConfigService } from '@/lib/db/services';

// Inicializar ou atualizar configuração do app (código de convite)
// Esta API deve ser protegida em produção!
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inviteSecret, adminKey } = body;

    // Verificar chave admin (use uma variável de ambiente em produção)
    const expectedAdminKey = process.env.ADMIN_KEY || 'super-secret-admin-key';
    
    if (adminKey !== expectedAdminKey) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    if (!inviteSecret) {
      return NextResponse.json(
        { error: 'Código de convite é obrigatório' },
        { status: 400 }
      );
    }

    // Criar ou atualizar configuração
    await appConfigService.setInviteCode(inviteSecret);

    return NextResponse.json({
      success: true,
      message: 'Configuração atualizada',
    });
  } catch (error) {
    console.error('Erro ao configurar app:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Verificar se configuração existe
export async function GET() {
  try {
    const inviteCode = await appConfigService.getInviteCode();

    return NextResponse.json({
      configured: !!inviteCode,
    });
  } catch (error) {
    console.error('Erro ao verificar configuração:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
