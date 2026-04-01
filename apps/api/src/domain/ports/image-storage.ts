export type UploadedImage = {
  secure_url: string;
  public_id: string;
};

/** Options aligned with common image CDN upload parameters (Cloudinary-compatible subset). */
export type ImageUploadOptions = {
  folder?: string;
  public_id?: string;
  overwrite?: boolean;
  resource_type?: "image" | "auto" | "raw" | "video";
};

export interface IImageStorage {
  uploadBuffer(buffer: Buffer, options?: ImageUploadOptions): Promise<UploadedImage>;
  destroy(publicId: string): Promise<void>;
}
