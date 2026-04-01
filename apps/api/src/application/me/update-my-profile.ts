import { normalizePhoneDigits } from "../utils/phone-digits.js";
import type { IGeoService } from "../../domain/ports/geo-service.js";
import type { IProfileRepository } from "../../domain/ports/profile-repository.js";
import type { IProviderRepository } from "../../domain/ports/provider-repository.js";
import type { IUserRepository } from "../../domain/ports/user-repository.js";
import { buildMePayload } from "./build-me-payload.js";

export type UpdateClientProfileInput = {
  name?: string;
  phone?: string;
  address?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string;
  photoUrl?: string | null;
};

export type UpdateProviderProfileInput = {
  name?: string;
  phone?: string;
  radiusKm?: number;
  workAddress?: string | null;
  workComplement?: string | null;
  workNeighborhood?: string | null;
  workCity?: string | null;
  workState?: string | null;
  workCep?: string;
  photoUrl?: string | null;
};

export type ProfileUpdateAudit =
  | {
      kind: "profile_updated";
      metadata: { role: string };
    }
  | null;

export type UpdateProfileResult =
  | {
      ok: true;
      payload: Awaited<ReturnType<typeof buildMePayload>>;
      audit: ProfileUpdateAudit;
    }
  | { ok: false; status: 400 | 404 | 409; message: string };

type ProfileDeps = {
  profiles: IProfileRepository;
  users: IUserRepository;
  geo: IGeoService;
  providers: IProviderRepository;
};

export async function updateClientProfile(
  deps: ProfileDeps,
  params: { userId: string; user: Record<string, unknown>; data: UpdateClientProfileInput }
): Promise<UpdateProfileResult> {
  const { profiles, users, geo, providers } = deps;
  const { userId, user, data } = params;

  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: Array<string | number | null> = [];
  let idx = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${idx++}`);
    values.push(data.name);
  }
  if (data.phone !== undefined) {
    const digits = normalizePhoneDigits(data.phone);
    if (await users.existsByPhoneDigits(digits, userId)) {
      return { ok: false, status: 409, message: "Telefone ja cadastrado" };
    }
    updates.push(`phone = $${idx++}`);
    values.push(data.phone.trim());
  }
  if (data.photoUrl !== undefined) {
    updates.push(`photo_url = $${idx++}`);
    values.push(data.photoUrl ?? null);
  }
  if (data.cep !== undefined) {
    const cep = geo.normalizeCep(data.cep);
    if (cep.length !== 8) {
      return { ok: false, status: 400, message: "CEP invalido" };
    }
    const prevCep = geo.normalizeCep(String(user.cep ?? ""));
    const cepUnchanged = prevCep.length === 8 && cep === prevCep;

    const addressParts = [
      data.address ?? user.address,
      data.complement,
      data.neighborhood,
      data.city,
      data.state,
      cep,
    ].filter(Boolean);
    const fullAddress = addressParts.join(", ");

    if (cepUnchanged) {
      updates.push(`address = $${idx++}`);
      values.push(fullAddress);
    } else {
      let coords = fullAddress.length > 5 ? await geo.getAddressCoords(fullAddress) : null;
      if (!coords) coords = await geo.getCepCoords(cep);
      if (!coords) {
        return { ok: false, status: 400, message: "Endereco ou CEP invalido" };
      }
      updates.push(`cep = $${idx++}`);
      values.push(cep);
      updates.push(`cep_lat = $${idx++}`);
      values.push(coords.lat);
      updates.push(`cep_lng = $${idx++}`);
      values.push(coords.lng);
      updates.push(`address = $${idx++}`);
      values.push(fullAddress);
    }
  } else if (
    data.address !== undefined ||
    data.complement !== undefined ||
    data.neighborhood !== undefined ||
    data.city !== undefined ||
    data.state !== undefined
  ) {
    const cepStored = geo.normalizeCep(String(user.cep ?? ""));
    if (cepStored.length !== 8) {
      return {
        ok: false,
        status: 400,
        message: "Informe um CEP valido no perfil antes de alterar o endereco",
      };
    }
    const line = data.address !== undefined ? data.address : user.address;
    const parts = [
      line,
      data.complement !== undefined ? data.complement : null,
      data.neighborhood !== undefined ? data.neighborhood : null,
      data.city !== undefined ? data.city : null,
      data.state !== undefined ? data.state : null,
      cepStored,
    ].filter((p) => p !== null && p !== undefined && String(p).trim() !== "");
    updates.push(`address = $${idx++}`);
    values.push(parts.join(", "));
  }

  updates.push(`updated_at = $${idx++}`);
  values.push(now);

  await profiles.updateById(userId, updates, values);
  const fresh = await profiles.findById(userId);
  if (!fresh) {
    return { ok: false, status: 404, message: "Usuario nao encontrado" };
  }

  const onlyTimestamp = updates.length === 1 && updates[0].startsWith("updated_at");
  const audit: ProfileUpdateAudit = onlyTimestamp
    ? null
    : { kind: "profile_updated", metadata: { role: String(user.role) } };

  return { ok: true, payload: await buildMePayload(providers, fresh), audit };
}

export async function updateProviderProfile(
  deps: ProfileDeps,
  params: { userId: string; user: Record<string, unknown>; data: UpdateProviderProfileInput }
): Promise<UpdateProfileResult> {
  const { profiles, users, geo, providers } = deps;
  const { userId, user, data } = params;

  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: Array<string | number | null> = [];
  let idx = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${idx++}`);
    values.push(data.name.trim());
  }
  if (data.phone !== undefined) {
    const digits = normalizePhoneDigits(data.phone);
    if (await users.existsByPhoneDigits(digits, userId)) {
      return { ok: false, status: 409, message: "Telefone ja cadastrado" };
    }
    updates.push(`phone = $${idx++}`);
    values.push(data.phone.trim());
  }
  if (data.radiusKm !== undefined) {
    updates.push(`radius_km = $${idx++}`);
    values.push(data.radiusKm);
  }
  if (data.workCep !== undefined || data.workAddress !== undefined) {
    const workCep = data.workCep ? geo.normalizeCep(data.workCep) : geo.normalizeCep(String(user.work_cep ?? ""));
    const workParts = [
      data.workAddress ?? user.work_address,
      data.workComplement,
      data.workNeighborhood,
      data.workCity,
      data.workState,
      workCep,
    ].filter(Boolean);
    const workAddressFull = workParts.join(", ");
    if (workCep.length !== 8) {
      return { ok: false, status: 400, message: "CEP do local de trabalho invalido" };
    }
    let coords = workAddressFull.length > 5 ? await geo.getAddressCoords(workAddressFull) : null;
    if (!coords) coords = await geo.getCepCoords(workCep);
    if (!coords) {
      return { ok: false, status: 400, message: "Endereco ou CEP do local de trabalho invalido" };
    }
    updates.push(`work_cep = $${idx++}`);
    values.push(workCep);
    updates.push(`work_lat = $${idx++}`);
    values.push(coords.lat);
    updates.push(`work_lng = $${idx++}`);
    values.push(coords.lng);
    updates.push(`work_address = $${idx++}`);
    values.push(workAddressFull);
  }
  if (data.photoUrl !== undefined) {
    updates.push(`photo_url = $${idx++}`);
    values.push(data.photoUrl ?? null);
  }

  updates.push(`updated_at = $${idx++}`);
  values.push(now);

  await profiles.updateById(userId, updates, values);
  const fresh = await profiles.findById(userId);
  if (!fresh) {
    return { ok: false, status: 404, message: "Usuario nao encontrado" };
  }

  const onlyTimestamp = updates.length === 1 && updates[0].startsWith("updated_at");
  const audit: ProfileUpdateAudit = onlyTimestamp
    ? null
    : { kind: "profile_updated", metadata: { role: String(user.role) } };

  return { ok: true, payload: await buildMePayload(providers, fresh), audit };
}
