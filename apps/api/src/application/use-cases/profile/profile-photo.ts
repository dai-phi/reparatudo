import type { IImageStorage } from "../../../domain/ports/image-storage.js";
import type { IProfileRepository } from "../../../domain/ports/repositories/profile-repository.js";
import type { IProviderRepository } from "../../../domain/ports/repositories/provider-repository.js";
import { destroyPublicIdIfAny } from "../../storage/destroy-public-id-if-any.js";
import { serializeUnknownError } from "../../utils/serialize-unknown-error.js";
import { buildMePayload } from "./build-me-payload.js";

export type ProfilePhotoResult =
  | { ok: true; payload: Awaited<ReturnType<typeof buildMePayload>> }
  | { ok: false; status: 404 | 500 | 502; message: string };

export async function uploadMyProfilePhoto(
  deps: {
    profiles: IProfileRepository;
    providers: IProviderRepository;
    cloudinary: IImageStorage | null;
  },
  params: { userId: string; user: Record<string, unknown>; buffer: Buffer }
): Promise<ProfilePhotoResult> {
  const { profiles, providers, cloudinary } = deps;
  const { userId, user, buffer } = params;

  if (!cloudinary) {
    return { ok: false, status: 500, message: "Servico de imagens nao configurado." };
  }

  await destroyPublicIdIfAny(
    cloudinary,
    user.photo_storage_key != null ? String(user.photo_storage_key) : null
  );

  let uploaded: { secure_url: string; public_id: string };
  try {
    uploaded = await cloudinary.uploadBuffer(buffer, {
      folder: "teu-faz-tudo",
      public_id: `profiles/${userId}`,
      overwrite: true,
      resource_type: "image",
    });
  } catch (e) {
    return { ok: false, status: 502, message: serializeUnknownError(e) };
  }

  const secureUrl = uploaded.secure_url;
  const storageKey = uploaded.public_id;

  const now = new Date().toISOString();
  await profiles.updateById(userId, ["photo_url = $1", "photo_storage_key = $2", "updated_at = $3"], [
    secureUrl,
    storageKey,
    now,
  ]);

  const fresh = await profiles.findById(userId);
  if (!fresh) {
    return { ok: false, status: 404, message: "Usuario nao encontrado" };
  }

  return { ok: true, payload: await buildMePayload(providers, fresh) };
}

export async function removeMyProfilePhoto(
  deps: {
    profiles: IProfileRepository;
    providers: IProviderRepository;
    cloudinary: IImageStorage | null;
  },
  params: { userId: string; user: Record<string, unknown> }
): Promise<ProfilePhotoResult> {
  const { profiles, providers, cloudinary } = deps;
  const { userId, user } = params;

  if (cloudinary) {
    await destroyPublicIdIfAny(
      cloudinary,
      user.photo_storage_key != null ? String(user.photo_storage_key) : null
    );
  }

  const now = new Date().toISOString();
  await profiles.updateById(userId, ["photo_url = $1", "photo_storage_key = $2", "updated_at = $3"], [
    null,
    null,
    now,
  ]);

  const fresh = await profiles.findById(userId);
  if (!fresh) {
    return { ok: false, status: 404, message: "Usuario nao encontrado" };
  }

  return { ok: true, payload: await buildMePayload(providers, fresh) };
}
