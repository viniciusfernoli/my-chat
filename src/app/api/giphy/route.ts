import { NextRequest, NextResponse } from 'next/server';

const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY;
const GIPHY_API_URL = 'https://api.giphy.com/v1/gifs';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get('search');
    const limit = url.searchParams.get('limit') || '20';
    const offset = url.searchParams.get('offset') || '0';

    if (!GIPHY_API_KEY) {
      return NextResponse.json(
        { error: 'GIPHY API key não configurada' },
        { status: 500 }
      );
    }

    let endpoint = `${GIPHY_API_URL}/trending`;
    const params = new URLSearchParams({
      api_key: GIPHY_API_KEY,
      limit,
      offset,
      rating: 'g',
    });

    if (search) {
      endpoint = `${GIPHY_API_URL}/search`;
      params.append('q', search);
    }

    const response = await fetch(`${endpoint}?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Erro ao buscar GIFs' },
        { status: response.status }
      );
    }

    const gifs = data.data.map((gif: {
      id: string;
      title: string;
      images: {
        original: { url: string; width: string; height: string };
        fixed_height: { url: string };
      };
    }) => ({
      id: gif.id,
      title: gif.title,
      url: gif.images.original.url,
      previewUrl: gif.images.fixed_height.url,
      width: parseInt(gif.images.original.width),
      height: parseInt(gif.images.original.height),
    }));

    return NextResponse.json({
      gifs,
      pagination: {
        totalCount: data.pagination.total_count,
        count: data.pagination.count,
        offset: data.pagination.offset,
      },
    });
  } catch (error) {
    console.error('Erro ao buscar GIFs:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
