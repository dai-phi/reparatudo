import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { IAuditLogWriter } from "../../../domain/ports/audit-log-writer.js";
import type { IGeoService } from "../../../domain/ports/geo-service.js";
import type { IUserRepository } from "../../../domain/ports/repositories/user-repository.js";
import type { IImageStorage } from "../../../domain/ports/image-storage.js";
import type { IProfileRepository } from "../../../domain/ports/repositories/profile-repository.js";
import type { IProviderRepository } from "../../../domain/ports/repositories/provider-repository.js";
import { buildMePayload } from "../../../application/me/build-me-payload.js";
import { uploadMyProfilePhoto, removeMyProfilePhoto } from "../../../application/me/profile-photo.js";
import { updateClientProfile, updateProviderProfile } from "../../../application/me/update-my-profile.js";
import { assertProviderImageMime, assertProviderImageSize } from "../utils/image-upload.js";
import { getHttpStatusFromError } from "../utils/serialize-error.js";
import { hashIpForAudit, userAgentSnippet } from "../utils/audit-request-context.js";
import { safeAuditAppend } from "../utils/safe-audit.js";

function clientIpFromRequest(request: import("fastify").FastifyRequest): string {
  const raw = request.ip || request.socket.remoteAddress || "";
  return String(raw).replace(/^::ffff:/, "") || "unknown";
}

const fullNameUpdate = z
  .string()
  .min(2)
  .refine((s) => s.trim().split(/\s+/).filter(Boolean).length >= 2, {
    message: "Informe nome completo (nome e sobrenome)",
  });

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

export type MeRoutesDeps = {
  profiles: IProfileRepository;
  users: IUserRepository;
  providers: IProviderRepository;
  geo: IGeoService;
  cloudinary: IImageStorage | null;
  audit?: IAuditLogWriter;
};

export async function registerMeRoutes(app: FastifyInstance, deps: MeRoutesDeps) {
  const { profiles, users, providers, geo, cloudinary } = deps;
  const extra = { audit: deps.audit };
  const auditSecret = process.env.JWT_SECRET || "dev-secret";
  const profileDeps = { profiles, users, geo, providers };

  app.get("/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await profiles.findById(request.user.sub);

    if (!user) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    return reply.send(await buildMePayload(providers, user));
  });

  app.patch("/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await profiles.findById(request.user.sub);

    if (!user) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    if (user.role === "client") {
      const parsed = updateClientSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ message: "Dados invalidos", issues: parsed.error.flatten() });
      }
      const result = await updateClientProfile(profileDeps, {
        userId: request.user.sub,
        user,
        data: parsed.data,
      });
      if (result.ok === false) {
        return reply.code(result.status).send({ message: result.message });
      }
      if (result.audit) {
        await safeAuditAppend(extra?.audit, request.log, {
          actorUserId: request.user.sub,
          action: result.audit.kind,
          entityType: "user",
          entityId: request.user.sub,
          metadata: result.audit.metadata,
          ipHashPrefix: hashIpForAudit(clientIpFromRequest(request), auditSecret),
          userAgentSnippet: userAgentSnippet(request),
        });
      }
      return reply.send(result.payload);
    }

    const parsed = updateProviderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Dados invalidos", issues: parsed.error.flatten() });
    }
    const result = await updateProviderProfile(profileDeps, {
      userId: request.user.sub,
      user,
      data: parsed.data,
    });
    if (result.ok === false) {
      return reply.code(result.status).send({ message: result.message });
    }
    if (result.audit) {
      await safeAuditAppend(extra?.audit, request.log, {
        actorUserId: request.user.sub,
        action: result.audit.kind,
        entityType: "user",
        entityId: request.user.sub,
        metadata: result.audit.metadata,
        ipHashPrefix: hashIpForAudit(clientIpFromRequest(request), auditSecret),
        userAgentSnippet: userAgentSnippet(request),
      });
    }
    return reply.send(result.payload);
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

    const result = await uploadMyProfilePhoto(
      { profiles, providers, cloudinary },
      { userId: request.user.sub, user, buffer }
    );
    if (result.ok === false) {
      return reply.code(result.status).send({ message: result.message });
    }

    await safeAuditAppend(extra?.audit, request.log, {
      actorUserId: request.user.sub,
      action: "profile_photo_updated",
      entityType: "user",
      entityId: request.user.sub,
      metadata: null,
      ipHashPrefix: hashIpForAudit(clientIpFromRequest(request), auditSecret),
      userAgentSnippet: userAgentSnippet(request),
    });

    return reply.send(result.payload);
  });

  app.delete("/me/photo", { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await profiles.findById(request.user.sub);
    if (!user) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    const result = await removeMyProfilePhoto({ profiles, providers, cloudinary }, { userId: request.user.sub, user });
    if (result.ok === false) {
      return reply.code(result.status).send({ message: result.message });
    }

    await safeAuditAppend(extra?.audit, request.log, {
      actorUserId: request.user.sub,
      action: "profile_photo_removed",
      entityType: "user",
      entityId: request.user.sub,
      metadata: null,
      ipHashPrefix: hashIpForAudit(clientIpFromRequest(request), auditSecret),
      userAgentSnippet: userAgentSnippet(request),
    });

    return reply.send(result.payload);
  });
}
