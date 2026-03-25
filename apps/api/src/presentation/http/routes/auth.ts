import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { SERVICE_IDS } from "../../../domain/value-objects/service-id.js";
import { registerClient } from "../../../application/auth/register-client.js";
import { registerProvider } from "../../../application/auth/register-provider.js";
import { login } from "../../../application/auth/login.js";
import { sanitizeUser } from "../../../application/auth/sanitize-user.js";
import type { IUserRepository } from "../../../domain/ports/user-repository.js";
import type { IPasswordHasher } from "../../../domain/ports/password-hasher.js";
import type { IGeoService } from "../../../domain/ports/geo-service.js";

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

const clientSchema = z
  .object({
    name: fullNameSchema,
    email: emailSchema,
    phone: phoneSchema,
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
    cpf: z.string().min(11).optional().nullable(),
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

export type AuthRouteDeps = {
  users: IUserRepository;
  geo: IGeoService;
  passwordHasher: IPasswordHasher;
};

export async function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps) {
  const authDeps = {
    users: deps.users,
    geo: deps.geo,
    passwordHasher: deps.passwordHasher,
  };

  app.post("/auth/register/client", async (request, reply) => {
    const parsed = handleValidation(clientSchema.safeParse(request.body), reply);
    if (!parsed) return;

    const result = await registerClient(authDeps, {
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
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

  app.post("/auth/register/provider", async (request, reply) => {
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

  app.post("/auth/login", async (request, reply) => {
    const parsed = handleValidation(loginSchema.safeParse(request.body), reply);
    if (!parsed) return;

    const result = await login(
      { users: deps.users, passwordHasher: deps.passwordHasher },
      { email: parsed.email, password: parsed.password }
    );

    if ("status" in result) {
      return reply.code(result.status).send({ message: result.message });
    }

    const token = await createToken(request, result.tokenPayload.sub, result.tokenPayload.role);
    setAuthCookie(reply, token);
    return reply.send({
      token,
      user: sanitizeUser(result.user),
    });
  });

  app.post("/auth/logout", async (_request, reply) => {
    const secure = process.env.NODE_ENV === "production";
    reply.clearCookie("token", { path: "/", sameSite: "lax", secure });
    return reply.code(204).send();
  });
}
