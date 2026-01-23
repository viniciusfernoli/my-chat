import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/db/services';
import { sendPasswordResetEmail } from '@/services/email-service';

// Função para gerar código de recuperação de 6 dígitos
function generateRecoveryCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    console.log('[AUTH] Solicitação de recuperação de chave');
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar usuário pelo email
    const user = await userService.findByEmail(email.toLowerCase().trim());

    if (!user) {
      // Por segurança, não revelamos se o email existe ou não
      console.log('[AUTH] Email não encontrado:', email);
      return NextResponse.json({
        message: 'Se o email estiver cadastrado, você receberá um código de recuperação.',
      });
    }

    // Gerar código de recuperação
    const recoveryCode = generateRecoveryCode();
    const recoveryExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Salvar código de recuperação no usuário
    await userService.setRecoveryCode(user.id, recoveryCode, recoveryExpires);

    // Enviar email
    console.log('[AUTH] Enviando email de recuperação para:', email);
    const emailSent = await sendPasswordResetEmail(email, recoveryCode, user.nickname);

    if (!emailSent) {
      console.error('[AUTH] Falha ao enviar email de recuperação');
      return NextResponse.json(
        { error: 'Erro ao enviar email. Tente novamente.' },
        { status: 500 }
      );
    }

    console.log('[AUTH] Código de recuperação enviado com sucesso');
    return NextResponse.json({
      message: 'Se o email estiver cadastrado, você receberá um código de recuperação.',
      userId: user.id, // Necessário para o próximo passo
    });
  } catch (error) {
    console.error('[AUTH] Erro na recuperação de chave:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
