import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/db/services';
import { sendVerificationEmail } from '@/services/email-service';

// Função para gerar código de verificação de 6 dígitos
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    console.log('[AUTH] Reenvio de código iniciado');
    const body = await request.json();
    console.log('[AUTH] Dados recebidos:', body);
    const { userId } = body;

    if (!userId) {
      console.warn('[AUTH] Dados incompletos:', body);
      return NextResponse.json(
        { error: 'Dados incompletos' },
        { status: 400 }
      );
    }

    // Buscar usuário
    const user = await userService.findById(userId);

    if (!user) {
      console.warn('[AUTH] Usuário não encontrado:', userId);
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      );
    }

    // Verificar se já está verificado
    if (user.emailVerified) {
      console.warn('[AUTH] Email já verificado:', user.email);
      return NextResponse.json(
        { error: 'Email já verificado' },
        { status: 400 }
      );
    }

    // Gerar novo código
    const verificationCode = generateVerificationCode();
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Atualizar usuário com novo código
    await userService.updateVerificationCode(userId, verificationCode, verificationExpires);

    // Enviar email
    console.log('[AUTH] Enviando email de verificação...');
    const emailSent = await sendVerificationEmail(
      user.email!,
      verificationCode,
      user.nickname
    );

    if (!emailSent) {
      console.error('[AUTH] Falha ao enviar email de verificação para:', user.email);
      return NextResponse.json(
        { error: 'Erro ao enviar email' },
        { status: 500 }
      );
    }

    console.log('[AUTH] Reenvio de código finalizado com sucesso:', userId);
    return NextResponse.json({
      message: 'Novo código enviado com sucesso',
    });
  } catch (error) {
    console.error('[AUTH] Erro ao reenviar código:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
