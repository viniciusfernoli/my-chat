import { NextRequest, NextResponse } from 'next/server';
import { conversationService, messageService, userService } from '@/lib/db/services';

// Buscar mensagens de uma conversa com PAGINAÇÃO (lazy loading)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar se usuário é participante
    const conversation = await conversationService.findById(id);
    
    if (!conversation || !conversation.participantIds.includes(userId)) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    // Buscar mensagens com paginação
    const result = await messageService.getByConversationPaginated(id, {
      limit,
      cursor: cursor || undefined,
      direction: 'before',
    });

    // Converter para formato da API (com batch para eficiência)
    const formattedMessages = await messageService.toApiFormatBatch(result.messages);

    return NextResponse.json({
      messages: formattedMessages.reverse(), // Mais antigas primeiro para exibição
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error('Erro ao buscar mensagens:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Enviar mensagem
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = request.headers.get('x-user-id');

    if (!userId) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Verificar se usuário é participante
    const conversation = await conversationService.findById(id);
    
    if (!conversation || !conversation.participantIds.includes(userId)) {
      return NextResponse.json(
        { error: 'Acesso negado' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { encryptedContent, nonce, type = 'text', mediaUrl, gifUrl, replyToId } = body;

    if (!encryptedContent || !nonce) {
      return NextResponse.json(
        { error: 'Conteúdo criptografado é obrigatório' },
        { status: 400 }
      );
    }

    // Criar mensagem (armazenamos o conteúdo criptografado)
    const message = await messageService.create({
      conversationId: id,
      senderId: userId,
      content: encryptedContent, // Conteúdo criptografado
      type: type as 'text' | 'image' | 'gif' | 'file' | 'audio' | 'video',
      replyToId,
      metadata: {
        nonce,
        mediaUrl,
        gifUrl,
      },
    });

    // Buscar dados do sender
    const sender = await userService.findById(userId);

    // Formatar resposta
    const formattedMessage = await messageService.toApiFormat(message);

    return NextResponse.json({
      ...formattedMessage,
      // Manter compatibilidade com formato antigo
      encryptedContent,
      nonce,
      mediaUrl,
      gifUrl,
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
