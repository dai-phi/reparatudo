import { randomUUID } from "node:crypto";
import type { IUserRepository } from "../../domain/ports/user-repository.js";
import type { IPasswordHasher } from "../../domain/ports/password-hasher.js";
import type { IGeoService } from "../../domain/ports/geo-service.js";
import type { UserRecord } from "../../domain/entities/records.js";
import { normalizePhoneDigits } from "../utils/phone-digits.js";
import { lookupViaCep } from "../utils/viacep-lookup.js";

export type RegisterClientInput = {
  name: string;
  email: string;
  phone: string;
  address: string;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep: string;
  password: string;
};

export type AuthSuccess = {
  user: UserRecord;
  tokenPayload: { sub: string; role: "client" | "provider" };
};

export type AuthFailure = { status: number; message: string };

export async function registerClient(
  deps: {
    users: IUserRepository;
    geo: IGeoService;
    passwordHasher: IPasswordHasher;
  },
  input: RegisterClientInput
): Promise<AuthSuccess | AuthFailure> {
  const email = input.email.toLowerCase();
  const phone = input.phone.trim();
  const phoneDigits = normalizePhoneDigits(phone);

  if (await deps.users.existsByEmailLower(email)) {
    return { status: 409, message: "E-mail ja cadastrado" };
  }
  if (phoneDigits.length >= 8 && (await deps.users.existsByPhoneDigits(phoneDigits))) {
    return { status: 409, message: "Telefone já cadastrado" };
  }

  const now = new Date().toISOString();
  const cep = deps.geo.normalizeCep(input.cep);
  const viaCep = await lookupViaCep(cep);
  if (!viaCep) {
    return { status: 400, message: "CEP não encontrado. Verifique o número informado." };
  }
  const addressParts = [
    input.address.trim(),
    input.complement?.trim(),
    input.neighborhood?.trim(),
    input.city?.trim(),
    input.state?.trim(),
    cep,
  ].filter(Boolean);
  const fullAddress = addressParts.join(", ");
  let coords = await deps.geo.getAddressCoords(fullAddress);
  if (!coords) {
    coords = await deps.geo.getCepCoords(cep);
  }
  if (!coords) {
    return { status: 400, message: "Endereco ou CEP invalido. Verifique os dados." };
  }

  const userId = randomUUID();
  const passwordHash = await deps.passwordHasher.hash(input.password);

  await deps.users.insertClient({
    id: userId,
    name: input.name.trim(),
    email,
    phone,
    cep,
    cepLat: coords.lat,
    cepLng: coords.lng,
    address: fullAddress,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  });

  const user: UserRecord = {
    id: userId,
    role: "client",
    name: input.name.trim(),
    email,
    phone,
    cep,
    cepLat: coords.lat,
    cepLng: coords.lng,
    workCep: null,
    workLat: null,
    workLng: null,
    workAddress: null,
    photoUrl: null,
    verificationDocumentUrl: null,
    address: fullAddress,
    cpf: null,
    radiusKm: null,
    services: null,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };

  return {
    user,
    tokenPayload: { sub: user.id, role: "client" },
  };
}
