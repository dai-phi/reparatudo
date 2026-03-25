import {
  v2 as cloudinary,
  type UploadApiOptions,
  type UploadApiResponse,
} from "cloudinary";

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
export class CloudinaryService {
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

  async uploadBuffer(
    buffer: Buffer,
    options?: UploadApiOptions,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        options ?? {},
        (err, result) => {
          if (err) {
            reject(err);
            return;
          }
          if (!result) {
            reject(new Error("Upload Cloudinary sem resposta."));
            return;
          }
          resolve(result);
        },
      );
      stream.end(buffer);
    });
  }

  async uploadPath(
    filePath: string,
    options?: UploadApiOptions,
  ): Promise<UploadApiResponse> {
    return cloudinary.uploader.upload(filePath, options);
  }

  async destroy(
    publicId: string,
    options?: UploadApiOptions,
  ): Promise<UploadApiResponse> {
    return cloudinary.uploader.destroy(publicId, options);
  }
}
