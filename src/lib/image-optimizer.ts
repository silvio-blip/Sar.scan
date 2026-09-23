/**
 * Utilitário de alta performance para otimização e compressão de imagens no cliente (Web / APK).
 * Reduz imagens de câmeras de alta resolução (10MB+) para ~150KB-250KB com máxima nitidez visual,
 * eliminando travamentos de memória no WebView do Android e erros de 'Request Entity Too Large'.
 */

export interface OptimizeImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

export async function optimizeImageForUpload(
  dataUrlOrFile: string | File | Blob,
  options: OptimizeImageOptions = {},
): Promise<string> {
  const { maxWidth = 1280, maxHeight = 1280, quality = 0.82, mimeType = "image/jpeg" } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();

    const processLoadedImage = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (!width || !height) {
          // Fallback se não conseguir ler dimensões
          resolve(typeof dataUrlOrFile === "string" ? dataUrlOrFile : "");
          return;
        }

        // Mantém a proporção exata da foto
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
        if (!ctx) {
          resolve(typeof dataUrlOrFile === "string" ? dataUrlOrFile : "");
          return;
        }

        // Configuração de interpolação suave
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Preenche fundo branco para evitar transparência preta em JPEGs
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        const optimizedBase64 = canvas.toDataURL(mimeType, quality);

        // Limpeza de memória
        canvas.width = 0;
        canvas.height = 0;

        resolve(optimizedBase64);
      } catch (err) {
        console.warn("[ImageOptimizer] Falha na compressão, usando original:", err);
        resolve(typeof dataUrlOrFile === "string" ? dataUrlOrFile : "");
      }
    };

    img.onload = processLoadedImage;
    img.onerror = (err) => {
      console.warn("[ImageOptimizer] Erro ao carregar imagem:", err);
      if (typeof dataUrlOrFile === "string") {
        resolve(dataUrlOrFile);
      } else {
        reject(new Error("Não foi possível carregar a imagem para processamento."));
      }
    };

    if (typeof dataUrlOrFile === "string") {
      img.src = dataUrlOrFile;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(dataUrlOrFile);
    }
  });
}
