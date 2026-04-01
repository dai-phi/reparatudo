import type { IImageStorage } from "../../../domain/ports/image-storage.js";

export async function destroyPublicIdIfAny(storage: IImageStorage, publicId: string | null | undefined): Promise<void> {
  if (!publicId) return;
  try {
    await storage.destroy(publicId);
  } catch {
    // recurso ja removido ou id invalido
  }
}
