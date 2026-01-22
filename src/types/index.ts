export * from './user';
export * from './message';

// Tipos de API
export interface IApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Tipos de Socket
export interface ISocketMessage {
  event: string;
  data: unknown;
}

// Tipos de GIF (Giphy)
export interface IGif {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
}

export interface IGiphySearchResult {
  gifs: IGif[];
  pagination: {
    totalCount: number;
    count: number;
    offset: number;
  };
}

// Tipos de Upload
export interface IUploadResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}
