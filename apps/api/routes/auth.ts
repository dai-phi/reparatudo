import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool } from "../db.js";
import { hashSecret, sanitizeUser, verifySecret } from "../auth.js";
import { SERVICE_IDS } from "../services.js";
import { getAddressCoords, getCepCoords, normalizeCep } from "../geo.js";

const emailSchema = z.string().email();
const phoneSchema = z.string().min(8);

const passwordSchema = z.string().min(6, "Senha deve ter no minimo 6 caracteres");

const clientSchema = z
  .object({
    name: z.string().min(2),
    email: emailSchema,
    phone: phoneSchema,
    address: z.string().min(3, "Endereco obrigatorio"),
    complement: z.string().optional().nullable(),
    neighborhood: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    cep: z.string().min(8),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Senhas nao conferem",
    path: ["passwordConfirm"],
  });

const providerSchema = z
  .object({
    name: z.string().min(2),
    email: emailSchema,
    phone: phoneSchema,
    cpf: z.string().min(11).optional().nullable(),
    radiusKm: z.coerce.number().min(1).max(50),
    services: z.array(z.enum(SERVICE_IDS)).min(1),
    workAddress: z.string().min(3, "Endereco do local de trabalho obrigatorio"),
    workComplement: z.string().optional().nullable(),
    workNeighborhood: z.string().optional().nullable(),
    workCity: z.string().optional().nullable(),
    workState: z.string().optional().nullable(),
    workCep: z.string().min(8),
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

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 dias em segundos

function setAuthCookie(reply: FastifyReply, token: string) {
  reply.setCookie("token", token, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

async function createToken(request: FastifyRequest, userId: string, role: string) {
  return request.server.jwt.sign({ sub: userId, role });
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/register/client", async (request, reply) => {
    const parsed = handleValidation(clientSchema.safeParse(request.body), reply);
    if (!parsed) return;

    const email = parsed.email.toLowerCase();
    const phone = parsed.phone.trim();

    const exists = await pool.query("SELECT 1 FROM users WHERE lower(email) = $1", [email]);
    if (exists.rowCount) {
      return reply.code(409).send({ message: "E-mail ja cadastrado" });
    }

    const now = new Date().toISOString();
    const cep = normalizeCep(parsed.cep);
    const addressParts = [
      parsed.address.trim(),
      parsed.complement?.trim(),
      parsed.neighborhood?.trim(),
      parsed.city?.trim(),
      parsed.state?.trim(),
      cep,
    ].filter(Boolean);
    const fullAddress = addressParts.join(", ");
    let coords = await getAddressCoords(fullAddress);
    if (!coords) {
      coords = await getCepCoords(cep);
    }
    if (!coords) {
      return reply.code(400).send({ message: "Endereco ou CEP invalido. Verifique os dados." });
    }
    const userId = randomUUID();
    const passwordHash = await hashSecret(parsed.password);

    await pool.query(
      `INSERT INTO users (id, role, name, email, phone, cep, cep_lat, cep_lng, address, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        userId,
        "client",
        parsed.name.trim(),
        email,
        phone,
        cep,
        coords.lat,
        coords.lng,
        fullAddress,
        passwordHash,
        now,
        now,
      ]
    );

    const user = {
      id: userId,
      role: "client" as const,
      name: parsed.name.trim(),
      email,
      phone,
      cep,
      cepLat: coords.lat,
      cepLng: coords.lng,
      address: fullAddress,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    const token = await createToken(request, user.id, user.role);
    setAuthCookie(reply, token);
    return reply.send({ token, user: sanitizeUser(user) });
  });

  app.post("/auth/register/provider", async (request, reply) => {
    const parsed = handleValidation(providerSchema.safeParse(request.body), reply);
    if (!parsed) return;

    const email = parsed.email.toLowerCase();
    const phone = parsed.phone.trim();

    const exists = await pool.query("SELECT 1 FROM users WHERE lower(email) = $1", [email]);
    if (exists.rowCount) {
      return reply.code(409).send({ message: "E-mail ja cadastrado" });
    }

    const now = new Date().toISOString();
    const workCep = normalizeCep(parsed.workCep);
    const workAddressParts = [
      parsed.workAddress.trim(),
      parsed.workComplement?.trim(),
      parsed.workNeighborhood?.trim(),
      parsed.workCity?.trim(),
      parsed.workState?.trim(),
      workCep,
    ].filter(Boolean);
    const workAddressFull = workAddressParts.join(", ");
    let coords = await getAddressCoords(workAddressFull);
    if (!coords) {
      coords = await getCepCoords(workCep);
    }
    if (!coords) {
      return reply.code(400).send({ message: "Endereco ou CEP do local de trabalho invalido. Verifique os dados." });
    }
    const userId = randomUUID();
    const passwordHash = await hashSecret(parsed.password);

    await pool.query(
      `INSERT INTO users (id, role, name, email, phone, cpf, radius_km, services, work_cep, work_lat, work_lng, work_address, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        userId,
        "provider",
        parsed.name.trim(),
        email,
        phone,
        parsed.cpf?.trim() || null,
        parsed.radiusKm,
        parsed.services,
        workCep,
        coords.lat,
        coords.lng,
        workAddressFull,
        passwordHash,
        now,
        now,
      ]
    );

    const user = {
      id: userId,
      role: "provider" as const,
      name: parsed.name.trim(),
      email,
      phone,
      cpf: parsed.cpf?.trim() || undefined,
      radiusKm: parsed.radiusKm,
      services: parsed.services,
      workCep,
      workLat: coords.lat,
      workLng: coords.lng,
      workAddress: workAddressFull,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    const token = await createToken(request, user.id, user.role);
    setAuthCookie(reply, token);
    return reply.send({ token, user: sanitizeUser(user) });
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = handleValidation(loginSchema.safeParse(request.body), reply);
    if (!parsed) return;

    const email = parsed.email.toLowerCase();
    const password = parsed.password;

    const result = await pool.query("SELECT * FROM users WHERE lower(email) = $1", [email]);
    const user = result.rows[0];

    if (!user) {
      return reply.code(401).send({ message: "Credenciais invalidas" });
    }

    const matches = await verifySecret(password, user.password_hash);
    if (!matches) {
      return reply.code(401).send({ message: "Credenciais invalidas" });
    }

    const token = await createToken(request, user.id, user.role);
    setAuthCookie(reply, token);
    return reply.send({
      token,
      user: sanitizeUser({
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address ?? undefined,
        cpf: user.cpf ?? undefined,
        radiusKm: user.radius_km ?? undefined,
        services: user.services ?? undefined,
        cep: user.cep ?? undefined,
        cepLat: user.cep_lat ?? undefined,
        cepLng: user.cep_lng ?? undefined,
        workCep: user.work_cep ?? undefined,
        workAddress: user.work_address ?? undefined,
        workLat: user.work_lat ?? undefined,
        workLng: user.work_lng ?? undefined,
        photoUrl: user.photo_url ?? undefined,
        passwordHash: user.password_hash,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      }),
    });
  });

  app.post("/auth/logout", async (_request, reply) => {
    reply.clearCookie("token", { path: "/" });
    return reply.code(204).send();
  });
}
