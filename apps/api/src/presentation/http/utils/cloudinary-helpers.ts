import type { CloudinaryService } from "../../../infrastructure/cloudinary/cloudinary-service.js";

export async function destroyPublicIdIfAny(cloudinary: CloudinaryService, publicId: string | null | undefined): Promise<void> {
  if (!publicId) return;
  try {
    await cloudinary.destroy(publicId);
  } catch {
    // recurso ja removido ou id invalido
  }
}
