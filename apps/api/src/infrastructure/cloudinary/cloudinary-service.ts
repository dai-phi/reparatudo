import {
  v2 as cloudinary,
  type UploadApiOptions,
  type UploadApiResponse,
} from "cloudinary";
import type { IImageStorage, ImageUploadOptions, UploadedImage } from "../../domain/ports/image-storage.js";

export type CloudinaryCredentials = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export function readCloudinaryEnv(): CloudinaryCredentials {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Defina CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET no ambiente.",
    );
  }
  return { cloudName, apiKey, apiSecret };
}

/**
 * Cliente Cloudinary configurado a partir das variáveis de ambiente (.env).
 */
export class CloudinaryService implements IImageStorage {
  constructor(credentials: CloudinaryCredentials = readCloudinaryEnv()) {
    // cloud_name tem de coincidir com o painel (maiúsculas/minúsculas importam para a API).
    cloudinary.config({
      cloud_name: credentials.cloudName,
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
      secure: true,
    });
  }

  /** Acesso ao SDK `v2` para casos avançados (transformações, admin API, etc.). */
  get v2() {
    return cloudinary;
  }

  async uploadBuffer(buffer: Buffer, options?: ImageUploadOptions): Promise<UploadedImage> {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        (options ?? {}) as UploadApiOptions,
        (err, res) => {
          if (err) {
            reject(err);
            return;
          }
          if (!res) {
            reject(new Error("Upload Cloudinary sem resposta."));
            return;
          }
          resolve(res);
        },
      );
      stream.end(buffer);
    });
    const secure_url = result.secure_url;
    const public_id = result.public_id;
    if (!secure_url || !public_id) {
      throw new Error("Upload Cloudinary sem secure_url ou public_id.");
    }
    return { secure_url, public_id };
  }

  async uploadPath(
    filePath: string,
    options?: UploadApiOptions,
  ): Promise<UploadApiResponse> {
    return cloudinary.uploader.upload(filePath, options);
  }

  async destroy(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}
