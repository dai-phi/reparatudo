import { randomUUID } from "node:crypto";
import type { IUserRepository } from "../../domain/ports/user-repository.js";
import type { IPasswordHasher } from "../../domain/ports/password-hasher.js";
import type { IGeoService } from "../../domain/ports/geo-service.js";
import type { UserRecord } from "../../domain/entities/records.js";
import type { ServiceId } from "../../domain/value-objects/service-id.js";
import type { AuthFailure, AuthSuccess } from "./register-client.js";
import { normalizePhoneDigits } from "../utils/phone-digits.js";
import { lookupViaCep } from "../utils/viacep-lookup.js";

export type RegisterProviderFormInput = {
  name: string;
  email: string;
  phone: string;
  cpf?: string | null;
  radiusKm: number;
  services: ServiceId[];
  workAddress: string;
  workComplement?: string | null;
  workNeighborhood?: string | null;
  workCity?: string | null;
  workState?: string | null;
  workCep: string;
  password: string;
};

/** Mídia já enviada ao Cloudinary antes do insert (cadastro multipart). */
export type ProviderRegistrationMedia = {
  userId: string;
  photoUrl?: string | null;
  photoStorageKey?: string | null;
  verificationDocumentUrl?: string | null;
  verificationDocumentStorageKey?: string | null;
};

export async function registerProvider(
  deps: {
    users: IUserRepository;
    geo: IGeoService;
    passwordHasher: IPasswordHasher;
  },
  input: RegisterProviderFormInput,
  media?: ProviderRegistrationMedia
): Promise<AuthSuccess | AuthFailure> {
  const email = input.email.toLowerCase();
  const phone = input.phone.trim();
  const phoneDigits = normalizePhoneDigits(phone);

  if (await deps.users.existsByEmailLower(email)) {
    return { status: 409, message: "E-mail ja cadastrado" };
  }
  if (phoneDigits.length >= 8 && (await deps.users.existsByPhoneDigits(phoneDigits))) {
    return { status: 409, message: "Telefone ja cadastrado" };
  }

  const now = new Date().toISOString();
  const workCep = deps.geo.normalizeCep(input.workCep);
  const viaCep = await lookupViaCep(workCep);
  if (!viaCep) {
    return { status: 400, message: "CEP nao encontrado. Verifique o numero informado." };
  }
  const workAddressParts = [
    input.workAddress.trim(),
    input.workComplement?.trim(),
    input.workNeighborhood?.trim(),
    input.workCity?.trim(),
    input.workState?.trim(),
    workCep,
  ].filter(Boolean);
  const workAddressFull = workAddressParts.join(", ");
  let coords = await deps.geo.getAddressCoords(workAddressFull);
  if (!coords) {
    coords = await deps.geo.getCepCoords(workCep);
  }
  if (!coords) {
    return {
      status: 400,
      message: "Endereco ou CEP do local de trabalho invalido. Verifique os dados.",
    };
  }

  const userId = media?.userId ?? randomUUID();
  const passwordHash = await deps.passwordHasher.hash(input.password);

  await deps.users.insertProvider({
    id: userId,
    name: input.name.trim(),
    email,
    phone,
    cpf: input.cpf?.trim() || null,
    radiusKm: input.radiusKm,
    services: input.services,
    workCep,
    workLat: coords.lat,
    workLng: coords.lng,
    workAddress: workAddressFull,
    passwordHash,
    photoUrl: media?.photoUrl ?? null,
    photoStorageKey: media?.photoStorageKey ?? null,
    verificationDocumentUrl: media?.verificationDocumentUrl ?? null,
    verificationDocumentStorageKey: media?.verificationDocumentStorageKey ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const user: UserRecord = {
    id: userId,
    role: "provider",
    name: input.name.trim(),
    email,
    phone,
    cep: null,
    cepLat: null,
    cepLng: null,
    workCep,
    workLat: coords.lat,
    workLng: coords.lng,
    workAddress: workAddressFull,
    photoUrl: media?.photoUrl ?? null,
    verificationDocumentUrl: media?.verificationDocumentUrl ?? null,
    address: null,
    cpf: input.cpf?.trim() || null,
    radiusKm: input.radiusKm,
    services: input.services,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };

  return {
    user,
    tokenPayload: { sub: user.id, role: "provider" },
  };
}
