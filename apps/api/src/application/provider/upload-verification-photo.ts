import type { IImageStorage } from "../../domain/ports/image-storage.js";
import type { IProviderRepository } from "../../domain/ports/provider-repository.js";
import { destroyPublicIdIfAny } from "../storage/destroy-public-id-if-any.js";
import { serializeUnknownError } from "../utils/serialize-unknown-error.js";

type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

function nextStatusAfterUpload(current: VerificationStatus): VerificationStatus {
  return current === "rejected" ? "unverified" : current;
}

export async function uploadVerificationDocument(
  deps: { providers: IProviderRepository; cloudinary: IImageStorage | null },
  params: { providerId: string; row: Record<string, unknown>; buffer: Buffer; verificationStatus: VerificationStatus }
): Promise<
  | { ok: true; documentUrl: string; verificationStatus: VerificationStatus }
  | { ok: false; httpStatus: 500 | 502; message: string }
> {
  const { providers, cloudinary } = deps;
  const { providerId, row, buffer, verificationStatus } = params;

  if (!cloudinary) {
    return { ok: false, httpStatus: 500, message: "Serviço de imagens não configurado." };
  }

  await destroyPublicIdIfAny(
    cloudinary,
    row.verification_document_storage_key != null ? String(row.verification_document_storage_key) : null
  );

  let uploaded: { secure_url: string; public_id: string };
  try {
    uploaded = await cloudinary.uploadBuffer(buffer, {
      folder: "teu-faz-tudo",
      public_id: `verification/document-${providerId}`,
      overwrite: true,
      resource_type: "image",
    });
  } catch (e) {
    return { ok: false, httpStatus: 502, message: serializeUnknownError(e) };
  }

  const nextStatus = nextStatusAfterUpload(verificationStatus);
  await providers.updateVerificationAssets(providerId, {
    verificationDocumentUrl: uploaded.secure_url,
    verificationDocumentStorageKey: uploaded.public_id,
    verificationStatus: nextStatus,
  });

  return { ok: true, documentUrl: uploaded.secure_url, verificationStatus: nextStatus };
}

export async function uploadVerificationSelfie(
  deps: { providers: IProviderRepository; cloudinary: IImageStorage | null },
  params: { providerId: string; row: Record<string, unknown>; buffer: Buffer; verificationStatus: VerificationStatus }
): Promise<
  | { ok: true; selfieUrl: string; verificationStatus: VerificationStatus }
  | { ok: false; httpStatus: 500 | 502; message: string }
> {
  const { providers, cloudinary } = deps;
  const { providerId, row, buffer, verificationStatus } = params;

  if (!cloudinary) {
    return { ok: false, httpStatus: 500, message: "Serviço de imagens não configurado." };
  }

  await destroyPublicIdIfAny(
    cloudinary,
    row.verification_selfie_storage_key != null ? String(row.verification_selfie_storage_key) : null
  );

  let uploaded: { secure_url: string; public_id: string };
  try {
    uploaded = await cloudinary.uploadBuffer(buffer, {
      folder: "teu-faz-tudo",
      public_id: `verification/selfie-${providerId}`,
      overwrite: true,
      resource_type: "image",
    });
  } catch (e) {
    return { ok: false, httpStatus: 502, message: serializeUnknownError(e) };
  }

  const nextStatus = nextStatusAfterUpload(verificationStatus);
  await providers.updateVerificationAssets(providerId, {
    verificationSelfieUrl: uploaded.secure_url,
    verificationSelfieStorageKey: uploaded.public_id,
    verificationStatus: nextStatus,
  });

  return { ok: true, selfieUrl: uploaded.secure_url, verificationStatus: nextStatus };
}
