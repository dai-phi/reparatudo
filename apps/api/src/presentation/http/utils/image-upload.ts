/** Tipos aceites para foto de perfil e foto de documento (verificação). */
export const PROVIDER_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const MAX_PROVIDER_IMAGE_BYTES = 5 * 1024 * 1024;

export function assertProviderImageMime(mimetype: string): void {
  if (!PROVIDER_IMAGE_MIME_TYPES.has(mimetype)) {
    throw new Error("Formato de imagem nao suportado. Use JPEG, PNG ou WebP.");
  }
}

export function assertProviderImageSize(byteLength: number): void {
  if (byteLength > MAX_PROVIDER_IMAGE_BYTES) {
    throw new Error("Imagem muito grande. Tamanho maximo 5 MB.");
  }
}
