import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { SERVICE_IDS } from "../../../domain/value-objects/service-id.js";
import { registerClient } from "../../../application/auth/register-client.js";
import { registerProvider } from "../../../application/auth/register-provider.js";
import { login } from "../../../application/auth/login.js";
import { sanitizeUser } from "../../../application/auth/sanitize-user.js";
import { requestPasswordReset } from "../../../application/auth/request-password-reset.js";
import { completePasswordReset } from "../../../application/auth/complete-password-reset.js";
import type { IUserRepository } from "../../../domain/ports/repositories/user-repository.js";
import type { IPasswordHasher } from "../../../domain/ports/password-hasher.js";
import type { IGeoService } from "../../../domain/ports/geo-service.js";
import type { IEmailSender } from "../../../domain/ports/email-sender.js";
import type { IPasswordResetTokenStore } from "../../../domain/ports/password-reset-token-store.js";
import type { IAuditLogWriter } from "../../../domain/ports/audit-log-writer.js";
import type { LoginThrottleService } from "../../../application/security/login-throttle.js";
import { createIpRateLimiter } from "../middleware/ip-rate-limit.js";
import type { IImageStorage } from "../../../domain/ports/image-storage.js";
import { assertProviderImageMime, assertProviderImageSize } from "../utils/image-upload.js";
import { parseProviderRegistrationMultipart } from "../utils/provider-registration-multipart.js";
import { serializeUnknownError } from "../utils/serialize-error.js";
import { hashIpForAudit, userAgentSnippet } from "../utils/audit-request-context.js";
import { safeAuditAppend } from "../utils/safe-audit.js";

const emailSchema = z.string().email();

const BR_UF = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

const fullNameSchema = z.string().min(2).refine(
  (s) => s.trim().split(/\s+/).filter(Boolean).length >= 2,
  { message: "Informe nome completo (nome e sobrenome)" }
);

const phoneSchema = z
  .string()
  .min(8)
  .refine((s) => {
    const d = s.replace(/\D/g, "");
    return d.length >= 10 && d.length <= 11;
  }, { message: "Telefone inválido (use DDD + número)" });

const cepDigitsSchema = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .pipe(z.string().length(8, { message: "CEP deve ter 8 dígitos" }));

const passwordSchema = z.string().min(6, "Senha deve ter no mínimo 6 caracteres");

function isValidCpfDigits(digits: string) {
  if (!/^\d{11}$/.test(digits)) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const nums = digits.split("").map((c) => Number(c));
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += nums[i] * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const d1 = calc(9);
  const d2 = calc(10);
  return d1 === nums[9] && d2 === nums[10];
}

const cpfDigitsSchema = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .pipe(z.string().length(11, { message: "CPF deve ter 11 dígitos" }))
  .refine((d) => isValidCpfDigits(d), { message: "CPF inválido" });

const clientSchema = z
  .object({
    name: fullNameSchema,
    email: emailSchema,
    phone: phoneSchema,
    cpf: cpfDigitsSchema,
    address: z.string().min(3, "Endereco obrigatorio"),
    complement: z.string().optional().nullable(),
    neighborhood: z.string().optional().nullable(),
    city: z.string().min(2, "Cidade obrigatoria"),
    state: z.enum(BR_UF, { message: "Selecione um estado valido" }),
    cep: cepDigitsSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Senhas nao conferem",
    path: ["passwordConfirm"],
  });

const providerSchema = z
  .object({
    name: fullNameSchema,
    email: emailSchema,
    phone: phoneSchema,
    cpf: cpfDigitsSchema,
    radiusKm: z.coerce.number().min(1).max(50),
    services: z.array(z.enum(SERVICE_IDS)).min(1),
    workAddress: z.string().min(3, "Endereco do local de trabalho obrigatorio"),
    workComplement: z.string().optional().nullable(),
    workNeighborhood: z.string().optional().nullable(),
    workCity: z.string().min(2, "Cidade obrigatoria"),
    workState: z.enum(BR_UF, { message: "Selecione um estado valido" }),
    workCep: cepDigitsSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Senhas nao conferem",
    path: ["passwordConfirm"],
  });

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const resetPasswordSchema = z
  .object({
    token: z.string().min(64, "Token invalido"),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Senhas nao conferem",
    path: ["passwordConfirm"],
  });

const FORGOT_PASSWORD_RESPONSE = {
  message:
    "Se existir uma conta com este e-mail, enviaremos instrucoes para redefinir a senha.",
};

function handleValidation<T>(result: z.SafeParseReturnType<T, T>, reply: FastifyReply) {
  if (!result.success) {
    reply.code(400).send({
      message: "Dados inválidos",
      issues: result.error.flatten(),
    });
    return null;
  }
  return result.data;
}

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

function setAuthCookie(reply: FastifyReply, token: string) {
  reply.setCookie("token", token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

async function createToken(request: FastifyRequest, userId: string, role: "client" | "provider") {
  return request.server.jwt.sign({ sub: userId, role });
}

function providerBodyFromMultipartFields(fields: Record<string, string>) {
  let services: unknown;
  try {
    services = JSON.parse(fields.services || "[]");
  } catch {
    return null;
  }
  const cpfRaw = (fields.cpf ?? "").trim().replace(/\D/g, "");
  return {
    name: fields.name ?? "",
    email: fields.email ?? "",
    phone: fields.phone ?? "",
    cpf: cpfRaw,
    radiusKm: Number(fields.radiusKm),
    services,
    workAddress: fields.workAddress ?? "",
    workComplement: fields.workComplement?.trim() || undefined,
    workNeighborhood: fields.workNeighborhood?.trim() || undefined,
    workCity: fields.workCity ?? "",
    workState: fields.workState ?? "",
    workCep: (fields.workCep ?? "").replace(/\D/g, ""),
    password: fields.password ?? "",
    passwordConfirm: fields.passwordConfirm ?? "",
  };
}

export type AuthRouteDeps = {
  users: IUserRepository;
  geo: IGeoService;
  passwordHasher: IPasswordHasher;
  emailSender?: IEmailSender;
  passwordResetTokens?: IPasswordResetTokenStore;
  audit?: IAuditLogWriter;
  loginThrottle?: LoginThrottleService;
  cloudinary: IImageStorage | null;
  ipRateLimit?: {
    login: ReturnType<typeof createIpRateLimiter>;
    registerClient: ReturnType<typeof createIpRateLimiter>;
    registerProvider: ReturnType<typeof createIpRateLimiter>;
    forgotPassword: ReturnType<typeof createIpRateLimiter>;
    resetPassword: ReturnType<typeof createIpRateLimiter>;
  };
};

function clientIpFromRequest(request: import("fastify").FastifyRequest): string {
  const raw = request.ip || request.socket.remoteAddress || "";
  return String(raw).replace(/^::ffff:/, "") || "unknown";
}

export async function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps) {
  const authDeps = {
    users: deps.users,
    geo: deps.geo,
    passwordHasher: deps.passwordHasher,
  };

  const preRegisterClient = deps.ipRateLimit?.registerClient
    ? { preHandler: [deps.ipRateLimit.registerClient] }
    : {};

  const preRegisterProvider = deps.ipRateLimit?.registerProvider
    ? { preHandler: [deps.ipRateLimit.registerProvider] }
    : {};

  const preLogin = deps.ipRateLimit?.login ? { preHandler: [deps.ipRateLimit.login] } : {};

  const preForgotPassword = deps.ipRateLimit?.forgotPassword
    ? { preHandler: [deps.ipRateLimit.forgotPassword] }
    : {};

  const preResetPassword = deps.ipRateLimit?.resetPassword
    ? { preHandler: [deps.ipRateLimit.resetPassword] }
    : {};

  const auditSecret = process.env.JWT_SECRET || "dev-secret";
  const appPublicUrl = process.env.APP_PUBLIC_URL?.trim() || "http://localhost:5173";

  app.post("/auth/register/client", preRegisterClient, async (request, reply) => {
    const parsed = handleValidation(clientSchema.safeParse(request.body), reply);
    if (!parsed) return;

    const result = await registerClient(authDeps, {
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      cpf: parsed.cpf,
      address: parsed.address,
      complement: parsed.complement,
      neighborhood: parsed.neighborhood,
      city: parsed.city,
      state: parsed.state,
      cep: parsed.cep,
      password: parsed.password,
    });

    if ("status" in result) {
      return reply.code(result.status).send({ message: result.message });
    }

    const token = await createToken(request, result.tokenPayload.sub, result.tokenPayload.role);
    setAuthCookie(reply, token);
    return reply.send({ token, user: sanitizeUser(result.user) });
  });

  app.post("/auth/register/provider", preRegisterProvider, async (request, reply) => {
    if (request.isMultipart()) {
      const { fields, profilePhoto } = await parseProviderRegistrationMultipart(request);
      const raw = providerBodyFromMultipartFields(fields);
      if (!raw) {
        return reply.code(400).send({ message: "Campo serviços inválido (JSON esperado)." });
      }
      const parsed = handleValidation(providerSchema.safeParse(raw), reply);
      if (!parsed) return;

      let media:
        | {
            userId: string;
            photoUrl: string;
            photoStorageKey: string;
            verificationDocumentUrl: null;
            verificationDocumentStorageKey: null;
          }
        | undefined;

      if (profilePhoto) {
        try {
          assertProviderImageMime(profilePhoto.mimetype);
          assertProviderImageSize(profilePhoto.buffer.length);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Imagem inválida";
          return reply.code(400).send({ message: msg });
        }

        if (!deps.cloudinary) {
          return reply.code(500).send({ message: "Serviço de imagens não configurado." });
        }
        const cloudinary = deps.cloudinary;

        const userId = randomUUID();
        try {
          const uploaded = await cloudinary.uploadBuffer(profilePhoto.buffer, {
            folder: "teu-faz-tudo",
            public_id: `profiles/${userId}`,
            overwrite: true,
            resource_type: "image",
          });
          media = {
            userId,
            photoUrl: uploaded.secure_url,
            photoStorageKey: uploaded.public_id,
            verificationDocumentUrl: null,
            verificationDocumentStorageKey: null,
          };
        } catch (e) {
          return reply.code(502).send({ message: serializeUnknownError(e) });
        }
      }

      const result = await registerProvider(
        authDeps,
        {
          name: parsed.name,
          email: parsed.email,
          phone: parsed.phone,
          cpf: parsed.cpf,
          radiusKm: parsed.radiusKm,
          services: parsed.services,
          workAddress: parsed.workAddress,
          workComplement: parsed.workComplement,
          workNeighborhood: parsed.workNeighborhood,
          workCity: parsed.workCity,
          workState: parsed.workState,
          workCep: parsed.workCep,
          password: parsed.password,
        },
        media
      );

      if ("status" in result) {
        return reply.code(result.status).send({ message: result.message });
      }

      const token = await createToken(request, result.tokenPayload.sub, result.tokenPayload.role);
      setAuthCookie(reply, token);
      return reply.send({ token, user: sanitizeUser(result.user) });
    }

    const parsed = handleValidation(providerSchema.safeParse(request.body), reply);
    if (!parsed) return;

    const result = await registerProvider(authDeps, {
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      cpf: parsed.cpf,
      radiusKm: parsed.radiusKm,
      services: parsed.services,
      workAddress: parsed.workAddress,
      workComplement: parsed.workComplement,
      workNeighborhood: parsed.workNeighborhood,
      workCity: parsed.workCity,
      workState: parsed.workState,
      workCep: parsed.workCep,
      password: parsed.password,
    });

    if ("status" in result) {
      return reply.code(result.status).send({ message: result.message });
    }

    const token = await createToken(request, result.tokenPayload.sub, result.tokenPayload.role);
    setAuthCookie(reply, token);
    return reply.send({ token, user: sanitizeUser(result.user) });
  });

  app.post("/auth/login", preLogin, async (request, reply) => {
    const parsed = handleValidation(loginSchema.safeParse(request.body), reply);
    if (!parsed) return;

    const emailLower = parsed.email.toLowerCase();
    const clientIp = clientIpFromRequest(request);

    if (deps.loginThrottle) {
      const key = deps.loginThrottle.keyFor(emailLower, clientIp);
      const lock = await deps.loginThrottle.isLocked(key, new Date());
      if (lock.locked) {
        return reply.code(429).send({
          message: "Muitas tentativas de login. Aguarde alguns minutos e tente novamente.",
        });
      }
    }

    const result = await login(
      { users: deps.users, passwordHasher: deps.passwordHasher },
      { email: parsed.email, password: parsed.password }
    );

    if ("status" in result) {
      if (deps.loginThrottle) {
        await deps.loginThrottle.onFailedLogin(emailLower, clientIp, new Date());
      }
      return reply.code(result.status).send({ message: result.message });
    }

    if (deps.loginThrottle) {
      await deps.loginThrottle.onSuccessfulLogin(emailLower, clientIp);
    }

    const token = await createToken(request, result.tokenPayload.sub, result.tokenPayload.role);
    setAuthCookie(reply, token);
    return reply.send({
      token,
      user: sanitizeUser(result.user),
    });
  });

  app.post("/auth/forgot-password", preForgotPassword, async (request, reply) => {
    const parsed = handleValidation(forgotPasswordSchema.safeParse(request.body), reply);
    if (!parsed) return;

    if (!deps.passwordResetTokens || !deps.emailSender) {
      return reply.code(503).send({ message: "Recuperacao de senha indisponivel no momento." });
    }

    await requestPasswordReset(
      {
        users: deps.users,
        email: deps.emailSender,
        tokens: deps.passwordResetTokens,
        appPublicUrl,
      },
      { email: parsed.email }
    );

    return reply.send(FORGOT_PASSWORD_RESPONSE);
  });

  app.post("/auth/reset-password", preResetPassword, async (request, reply) => {
    const parsed = handleValidation(resetPasswordSchema.safeParse(request.body), reply);
    if (!parsed) return;

    if (!deps.passwordResetTokens) {
      return reply.code(503).send({ message: "Recuperacao de senha indisponivel no momento." });
    }

    const result = await completePasswordReset(
      {
        users: deps.users,
        passwordHasher: deps.passwordHasher,
        tokens: deps.passwordResetTokens,
      },
      { token: parsed.token, password: parsed.password }
    );

    if (result.ok === false) {
      return reply.code(400).send({ message: result.message });
    }

    await safeAuditAppend(deps.audit, request.log, {
      actorUserId: result.userId,
      action: "password_reset_completed",
      entityType: "user",
      entityId: result.userId,
      metadata: null,
      ipHashPrefix: hashIpForAudit(clientIpFromRequest(request), auditSecret),
      userAgentSnippet: userAgentSnippet(request),
    });

    if (deps.loginThrottle) {
      const refreshed = await deps.users.findById(result.userId);
      if (refreshed) {
        await deps.loginThrottle.onSuccessfulLogin(refreshed.email.toLowerCase(), clientIpFromRequest(request));
      }
    }

    return reply.send({ message: "Senha alterada com sucesso. Voce ja pode entrar." });
  });

  app.post("/auth/logout", async (_request, reply) => {
    const secure = process.env.NODE_ENV === "production";
    reply.clearCookie("token", { path: "/", sameSite: "lax", secure });
    return reply.code(204).send();
  });
}
