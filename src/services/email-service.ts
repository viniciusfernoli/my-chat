import nodemailer from 'nodemailer';

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || 'SecureChat <noreply@securechat.com>';

// Configuração do transporte de email (Zoho)
const getTransporter = () => {
  return nodemailer.createTransport({
    service: 'Zoho',
    host: 'smtp.zoho.com',
    port: 465,
    secure: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASSWORD,
    },
  });
};

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    console.log('[EMAIL] Tentando enviar email...');
    console.log('[EMAIL] Dados:', {
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject
    });
    if (!EMAIL_USER || !EMAIL_PASSWORD) {
      console.warn('⚠️ Email não configurado. Variáveis EMAIL_USER e EMAIL_PASSWORD não definidas.');
      return false;
    }

    const transporter = getTransporter();

    const mailOptions = {
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      headers: {
        'List-Unsubscribe': '<mailto:unsubscribe@nacaochelsea.net>'
      }
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[EMAIL] Email enviado para ${options.to}`);
      console.log('[EMAIL] Info:', info);
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao enviar email:', error);
      if (error && error.response) {
        console.error('[EMAIL] SMTP Response:', error.response);
      }
      return false;
    }
  } catch (error) {
    console.error('❌ Erro inesperado no serviço de email:', error);
    return false;
  }
}

export async function sendVerificationEmail(
  email: string, 
  code: string, 
  nickname: string
): Promise<boolean> {
  console.log(`[EMAIL] Preparando email de verificação para ${email} (${nickname}) com código ${code}`);
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verificação de Email</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f1419;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f1419;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" style="max-width: 500px; background-color: #1a1f2e; border-radius: 16px; overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 30px 40px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                    🔐 SecureChat
                  </h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <p style="margin: 0 0 20px; color: #e5e7eb; font-size: 16px; line-height: 1.6;">
                    Olá <strong style="color: #ffffff;">${nickname}</strong>! 👋
                  </p>
                  
                  <p style="margin: 0 0 30px; color: #9ca3af; font-size: 14px; line-height: 1.6;">
                    Bem-vindo ao SecureChat! Use o código abaixo para verificar seu email e ativar sua conta:
                  </p>
                  
                  <!-- Code Box -->
                  <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 30px;">
                    <p style="margin: 0 0 10px; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">
                      Código de Verificação
                    </p>
                    <p style="margin: 0; color: #3b82f6; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                      ${code}
                    </p>
                  </div>
                  
                  <p style="margin: 0 0 20px; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                    ⏱️ Este código expira em <strong style="color: #f59e0b;">15 minutos</strong>.
                  </p>
                  
                  <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                    Se você não solicitou esta verificação, ignore este email.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #0f172a; padding: 20px 40px; text-align: center; border-top: 1px solid #1e293b;">
                  <p style="margin: 0; color: #4b5563; font-size: 11px;">
                    © ${new Date().getFullYear()} SecureChat - Mensagens seguras com criptografia E2E
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: '🔐 Código de Verificação - SecureChat',
    html,
  });
}

export async function sendPasswordResetEmail(
  email: string, 
  code: string, 
  nickname: string
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recuperação de Conta</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f1419;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f1419;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" style="max-width: 500px; background-color: #1a1f2e; border-radius: 16px; overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); padding: 30px 40px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                    🔑 Recuperação de Conta
                  </h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <p style="margin: 0 0 20px; color: #e5e7eb; font-size: 16px; line-height: 1.6;">
                    Olá <strong style="color: #ffffff;">${nickname}</strong>,
                  </p>
                  
                  <p style="margin: 0 0 30px; color: #9ca3af; font-size: 14px; line-height: 1.6;">
                    Recebemos uma solicitação para recuperar sua conta. Use o código abaixo:
                  </p>
                  
                  <!-- Code Box -->
                  <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border: 2px solid #ef4444; border-radius: 12px; padding: 25px; text-align: center; margin-bottom: 30px;">
                    <p style="margin: 0 0 10px; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">
                      Código de Recuperação
                    </p>
                    <p style="margin: 0; color: #ef4444; font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                      ${code}
                    </p>
                  </div>
                  
                  <p style="margin: 0 0 20px; color: #9ca3af; font-size: 13px; line-height: 1.6;">
                    ⏱️ Este código expira em <strong style="color: #f59e0b;">15 minutos</strong>.
                  </p>
                  
                  <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.6;">
                    ⚠️ Se você não solicitou esta recuperação, sua conta pode estar em risco. Por favor, verifique sua segurança.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #0f172a; padding: 20px 40px; text-align: center; border-top: 1px solid #1e293b;">
                  <p style="margin: 0; color: #4b5563; font-size: 11px;">
                    © ${new Date().getFullYear()} SecureChat - Mensagens seguras com criptografia E2E
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: '🔑 Recuperação de Conta - SecureChat',
    html,
  });
}
