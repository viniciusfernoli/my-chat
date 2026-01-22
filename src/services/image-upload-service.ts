// Serviço de upload de imagens
// Usa base64 para simplicidade, mas pode ser adaptado para Cloudinary, S3, etc.

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export interface UploadResult {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
}

export class ImageUploadService {
  // Validar arquivo
  static validateFile(file: File): { valid: boolean; error?: string } {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: 'Tipo de arquivo não suportado. Use JPG, PNG, GIF ou WebP.' };
    }

    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'Arquivo muito grande. Máximo de 5MB.' };
    }

    return { valid: true };
  }

  // Converter File para base64
  static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }

  // Converter Blob para File
  static blobToFile(blob: Blob, filename: string): File {
    return new File([blob], filename, { type: blob.type });
  }

  // Redimensionar imagem se necessário (max 1920px)
  static async resizeImage(file: File, maxWidth = 1920, maxHeight = 1920): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        
        // Verificar se precisa redimensionar
        if (width <= maxWidth && height <= maxHeight) {
          resolve(file);
          return;
        }

        // Calcular novas dimensões mantendo proporção
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        // Criar canvas e redimensionar
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Converter para blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(this.blobToFile(blob, file.name));
            } else {
              resolve(file);
            }
          },
          file.type,
          0.9
        );
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // Upload de imagem (retorna base64 data URL)
  static async upload(file: File): Promise<UploadResult> {
    // Validar
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Redimensionar se necessário
    const resizedFile = await this.resizeImage(file);

    // Converter para base64
    const base64 = await this.fileToBase64(resizedFile);

    return {
      url: base64,
      filename: file.name,
      size: resizedFile.size,
      mimeType: resizedFile.type,
    };
  }

  // Extrair imagem do clipboard
  static async getImageFromClipboard(clipboardData: DataTransfer): Promise<File | null> {
    const items = clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          // Renomear para ter extensão correta
          const ext = item.type.split('/')[1];
          const filename = `clipboard-${Date.now()}.${ext}`;
          return this.blobToFile(file, filename);
        }
      }
    }
    
    return null;
  }

  // Criar thumbnail para preview
  static async createThumbnail(file: File, maxSize = 200): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        
        // Calcular dimensões do thumbnail
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Erro ao criar thumbnail'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
}
