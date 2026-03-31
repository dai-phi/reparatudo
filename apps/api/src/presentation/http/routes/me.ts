import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sanitizeUser } from "../../../application/auth/sanitize-user.js";
import { normalizePhoneDigits } from "../../../application/utils/phone-digits.js";
import type { IUserRepository } from "../../../domain/ports/user-repository.js";
import { CloudinaryService } from "../../../infrastructure/cloudinary/cloudinary-service.js";
import { PostgresGeoService } from "../../../infrastructure/geo/postgres-geo-service.js";
import { PostgresProfileRepository } from "../../../infrastructure/persistence/repository/postgres-profile-repository.js";
import { PostgresProviderRepository } from "../../../infrastructure/persistence/repository/postgres-provider-repository.js";
import { PostgresUserRepository } from "../../../infrastructure/persistence/repository/postgres-user-repository.js";
import { formatDate } from "../../utils/format.js";
import { destroyPublicIdIfAny } from "../utils/cloudinary-helpers.js";
import { assertProviderImageMime, assertProviderImageSize } from "../utils/image-upload.js";
import { getHttpStatusFromError, serializeUnknownError } from "../utils/serialize-error.js";

const geo = new PostgresGeoService();

const fullNameUpdate = z
  .string()
  .min(2)
  .refine((s) => s.trim().split(/\s+/).filter(Boolean).length >= 2, { message: "Informe nome completo (nome e sobrenome)" });

const phoneUpdate = z
  .string()
  .min(8)
  .refine((s) => {
    const d = s.replace(/\D/g, "");
    return d.length >= 10 && d.length <= 11;
  }, { message: "Telefone invalido (use DDD + numero)" });

const optionalPhotoUrl = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  z.union([z.string().url(), z.null()]).optional()
);

const updateClientSchema = z.object({
  name: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v),
    fullNameUpdate.optional()
  ),
  phone: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    phoneUpdate.optional()
  ),
  address: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  cep: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\D/g, "") : v),
    z.string().length(8).optional()
  ),
  photoUrl: optionalPhotoUrl,
});

const updateProviderSchema = z.object({
  name: z.preprocess(
    (v) => {
      if (typeof v !== "string") return undefined;
      const t = v.trim();
      return t === "" ? undefined : t;
    },
    fullNameUpdate.optional()
  ),
  phone: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    phoneUpdate.optional()
  ),
  radiusKm: z.coerce.number().min(1).max(50).optional(),
  workAddress: z.string().optional().nullable(),
  workComplement: z.string().optional().nullable(),
  workNeighborhood: z.string().optional().nullable(),
  workCity: z.string().optional().nullable(),
  workState: z.string().optional().nullable(),
  workCep: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\D/g, "") : v),
    z.string().length(8).optional()
  ),
  photoUrl: optionalPhotoUrl,
});

async function loadCurrentPlanSummary(
  providers: PostgresProviderRepository,
  userId: string,
  role: string
): Promise<
  | {
      id: string;
      code: string;
      name: string;
      status: string;
      expiresAt: string;
      expiresAtLabel: string;
    }
  | null
> {
  if (role !== "provider") {
    return null;
  }

  const currentAt = new Date().toISOString();
  await providers.refreshExpiredPlanSubscriptions(userId, currentAt);

  const currentPlan = await providers.findCurrentPlanSubscription(userId);
  if (!currentPlan) {
    return null;
  }

  const expiresAt = String(currentPlan.expires_at);
  return {
    id: String(currentPlan.plan_id),
    code: String(currentPlan.plan_code),
    name: String(currentPlan.plan_name),
    status: String(currentPlan.status),
    expiresAt,
    expiresAtLabel: formatDate(expiresAt),
  };
}

async function mapMePayload(providers: PostgresProviderRepository, user: Record<string, unknown>) {
  const currentPlan = await loadCurrentPlanSummary(providers, String(user.id), String(user.role));

  return sanitizeUser({
    id: String(user.id),
    role: String(user.role),
    name: String(user.name),
    email: String(user.email),
    phone: String(user.phone),
    address: user.address != null ? String(user.address) : null,
    cpf: user.cpf != null ? String(user.cpf) : null,
    radiusKm: user.radius_km != null ? Number(user.radius_km) : null,
    services: (user.services as string[] | null) ?? null,
    cep: user.cep != null ? String(user.cep) : null,
    cepLat: user.cep_lat != null ? Number(user.cep_lat) : null,
    cepLng: user.cep_lng != null ? Number(user.cep_lng) : null,
    workCep: user.work_cep != null ? String(user.work_cep) : null,
    workAddress: user.work_address != null ? String(user.work_address) : null,
    workLat: user.work_lat != null ? Number(user.work_lat) : null,
    workLng: user.work_lng != null ? Number(user.work_lng) : null,
    photoUrl: user.photo_url != null ? String(user.photo_url) : null,
    passwordHash: String(user.password_hash),
    createdAt: String(user.created_at),
    updatedAt: String(user.updated_at),
    currentPlan,
  });
}

export async function registerMeRoutes(
  app: FastifyInstance,
  profiles: PostgresProfileRepository = new PostgresProfileRepository(),
  users: IUserRepository = new PostgresUserRepository(),
  providers: PostgresProviderRepository = new PostgresProviderRepository()
) {
  app.get("/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await profiles.findById(request.user.sub);

    if (!user) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    return reply.send(await mapMePayload(providers, user));
  });

  app.patch("/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await profiles.findById(request.user.sub);

    if (!user) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: Array<string | number | null> = [];
    let idx = 1;

    if (user.role === "client") {
      const parsed = updateClientSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: "Dados invalidos", issues: parsed.error.flatten() });
      }
      const data = parsed.data;

      if (data.name !== undefined) {
        updates.push(`name = $${idx++}`);
        values.push(data.name);
      }
      if (data.phone !== undefined) {
        const digits = normalizePhoneDigits(data.phone);
        if (await users.existsByPhoneDigits(digits, request.user.sub)) {
          return reply.code(409).send({ message: "Telefone ja cadastrado" });
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
          return reply.code(400).send({ message: "CEP invalido" });
        }
        const prevCep = geo.normalizeCep(user.cep ?? "");
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
            return reply.code(400).send({ message: "Endereco ou CEP invalido" });
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
        const cepStored = geo.normalizeCep(user.cep ?? "");
        if (cepStored.length !== 8) {
          return reply.code(400).send({ message: "Informe um CEP valido no perfil antes de alterar o endereco" });
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
    } else {
      const parsed = updateProviderSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: "Dados invalidos", issues: parsed.error.flatten() });
      }
      const data = parsed.data;

      if (data.name !== undefined) {
        updates.push(`name = $${idx++}`);
        values.push(data.name.trim());
      }
      if (data.phone !== undefined) {
        const digits = normalizePhoneDigits(data.phone);
        if (await users.existsByPhoneDigits(digits, request.user.sub)) {
          return reply.code(409).send({ message: "Telefone ja cadastrado" });
        }
        updates.push(`phone = $${idx++}`);
        values.push(data.phone.trim());
      }
      if (data.radiusKm !== undefined) {
        updates.push(`radius_km = $${idx++}`);
        values.push(data.radiusKm);
      }
      if (data.workCep !== undefined || data.workAddress !== undefined) {
        const workCep = data.workCep ? geo.normalizeCep(data.workCep) : (user.work_cep ?? "");
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
          return reply.code(400).send({ message: "CEP do local de trabalho invalido" });
        }
        let coords = workAddressFull.length > 5 ? await geo.getAddressCoords(workAddressFull) : null;
        if (!coords) coords = await geo.getCepCoords(workCep);
        if (!coords) {
          return reply.code(400).send({ message: "Endereco ou CEP do local de trabalho invalido" });
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
    }

    updates.push(`updated_at = $${idx++}`);
    values.push(now);

    await profiles.updateById(request.user.sub, updates, values);
    const fresh = await profiles.findById(request.user.sub);
    if (!fresh) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    return reply.send(await mapMePayload(providers, fresh));
  });

  app.post("/me/photo", { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await profiles.findById(request.user.sub);
    if (!user) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    const file = await request.file();
    if (!file || file.fieldname !== "photo") {
      return reply.code(400).send({ message: 'Envie uma imagem no campo "photo".' });
    }

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch (e) {
      const code = getHttpStatusFromError(e) ?? 413;
      return reply.code(code).send({ message: "Imagem muito grande ou invalida." });
    }

    try {
      assertProviderImageMime(file.mimetype);
      assertProviderImageSize(buffer.length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Imagem invalida";
      return reply.code(400).send({ message: msg });
    }

    let cloudinary: CloudinaryService;
    try {
      cloudinary = new CloudinaryService();
    } catch {
      return reply.code(500).send({ message: "Servico de imagens nao configurado." });
    }

    await destroyPublicIdIfAny(cloudinary, user.photo_storage_key ?? null);

    let uploaded;
    try {
      uploaded = await cloudinary.uploadBuffer(buffer, {
        folder: "teu-faz-tudo",
        public_id: `profiles/${request.user.sub}`,
        overwrite: true,
        resource_type: "image",
      });
    } catch (e) {
      return reply.code(502).send({ message: serializeUnknownError(e) });
    }

    const secureUrl = uploaded.secure_url;
    const storageKey = uploaded.public_id;

    const now = new Date().toISOString();
    await profiles.updateById(request.user.sub, ["photo_url = $1", "photo_storage_key = $2", "updated_at = $3"], [
      secureUrl,
      storageKey,
      now,
    ]);

    const fresh = await profiles.findById(request.user.sub);
    if (!fresh) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    return reply.send(await mapMePayload(providers, fresh));
  });

  app.delete("/me/photo", { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await profiles.findById(request.user.sub);
    if (!user) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    try {
      const cloudinary = new CloudinaryService();
      await destroyPublicIdIfAny(cloudinary, user.photo_storage_key ?? null);
    } catch {
      // sem credenciais Cloudinary: limpa so a BD
    }

    const now = new Date().toISOString();
    await profiles.updateById(request.user.sub, ["photo_url = $1", "photo_storage_key = $2", "updated_at = $3"], [
      null,
      null,
      now,
    ]);

    const fresh = await profiles.findById(request.user.sub);
    if (!fresh) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    return reply.send(await mapMePayload(providers, fresh));
  });
}
