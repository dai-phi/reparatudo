import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db.js";
import { sanitizeUser } from "../auth.js";
import { getAddressCoords, getCepCoords, normalizeCep } from "../geo.js";

const updateClientSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  address: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  cep: z.string().min(8).optional(),
});

const updateProviderSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  radiusKm: z.coerce.number().min(1).max(50).optional(),
  workAddress: z.string().optional().nullable(),
  workComplement: z.string().optional().nullable(),
  workNeighborhood: z.string().optional().nullable(),
  workCity: z.string().optional().nullable(),
  workState: z.string().optional().nullable(),
  workCep: z.string().min(8).optional(),
  photoUrl: z.string().url().optional().nullable(),
});

export async function registerMeRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [request.user.sub]);
    const user = result.rows[0];

    if (!user) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    return reply.send(
      sanitizeUser({
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
      })
    );
  });

  app.patch("/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [request.user.sub]);
    const user = result.rows[0];

    if (!user) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    const schema = user.role === "provider" ? updateProviderSchema : updateClientSchema;
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Dados invalidos", issues: parsed.error.flatten() });
    }

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: Array<string | number | null> = [];
    let idx = 1;

    if (parsed.data.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(parsed.data.name.trim());
    }
    if (parsed.data.phone !== undefined) {
      updates.push(`phone = $${idx++}`);
      values.push(parsed.data.phone.trim());
    }
    if (parsed.data.address !== undefined) {
      updates.push(`address = $${idx++}`);
      values.push(parsed.data.address ?? null);
    }
    if (parsed.data.cep !== undefined) {
      const cep = normalizeCep(parsed.data.cep);
      if (cep.length !== 8) {
        return reply.code(400).send({ message: "CEP invalido" });
      }
      const addressParts = [
        parsed.data.address ?? user.address,
        parsed.data.complement,
        parsed.data.neighborhood,
        parsed.data.city,
        parsed.data.state,
        cep,
      ].filter(Boolean);
      const fullAddress = addressParts.join(", ");
      let coords = fullAddress.length > 5 ? await getAddressCoords(fullAddress) : null;
      if (!coords) coords = await getCepCoords(cep);
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
    if (parsed.data.radiusKm !== undefined) {
      updates.push(`radius_km = $${idx++}`);
      values.push(parsed.data.radiusKm);
    }
    if (user.role === "provider" && (parsed.data.workCep !== undefined || parsed.data.workAddress !== undefined)) {
      const workCep = parsed.data.workCep ? normalizeCep(parsed.data.workCep) : (user.work_cep ?? "");
      const workParts = [
        parsed.data.workAddress ?? user.work_address,
        parsed.data.workComplement,
        parsed.data.workNeighborhood,
        parsed.data.workCity,
        parsed.data.workState,
        workCep,
      ].filter(Boolean);
      const workAddressFull = workParts.join(", ");
      if (workCep.length !== 8) {
        return reply.code(400).send({ message: "CEP do local de trabalho invalido" });
      }
      let coords = workAddressFull.length > 5 ? await getAddressCoords(workAddressFull) : null;
      if (!coords) coords = await getCepCoords(workCep);
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
    if (parsed.data.photoUrl !== undefined) {
      updates.push(`photo_url = $${idx++}`);
      values.push(parsed.data.photoUrl ?? null);
    }

    updates.push(`updated_at = $${idx++}`);
    values.push(now);

    values.push(request.user.sub);

    await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${idx} `,
      values
    );

    const updated = await pool.query("SELECT * FROM users WHERE id = $1", [request.user.sub]);
    const fresh = updated.rows[0];

    return reply.send(
      sanitizeUser({
        id: fresh.id,
        role: fresh.role,
        name: fresh.name,
        email: fresh.email,
        phone: fresh.phone,
        address: fresh.address ?? undefined,
        cpf: fresh.cpf ?? undefined,
        radiusKm: fresh.radius_km ?? undefined,
        services: fresh.services ?? undefined,
        cep: fresh.cep ?? undefined,
        cepLat: fresh.cep_lat ?? undefined,
        cepLng: fresh.cep_lng ?? undefined,
        workCep: fresh.work_cep ?? undefined,
        workAddress: fresh.work_address ?? undefined,
        workLat: fresh.work_lat ?? undefined,
        workLng: fresh.work_lng ?? undefined,
        photoUrl: fresh.photo_url ?? undefined,
        passwordHash: fresh.password_hash,
        createdAt: fresh.created_at,
        updatedAt: fresh.updated_at,
      })
    );
  });
}
