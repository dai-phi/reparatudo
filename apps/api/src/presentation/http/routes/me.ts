import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sanitizeUser } from "../../../application/auth/sanitize-user.js";
import { PostgresGeoService } from "../../../infrastructure/geo/postgres-geo-service.js";
import { PostgresProfileRepository } from "../../../infrastructure/persistence/repository/postgres-profile-repository.js";

const geo = new PostgresGeoService();

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

export async function registerMeRoutes(
  app: FastifyInstance,
  profiles: PostgresProfileRepository = new PostgresProfileRepository()
) {
  app.get("/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await profiles.findById(request.user.sub);

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
        address: user.address ?? null,
        cpf: user.cpf ?? null,
        radiusKm: user.radius_km ?? null,
        services: user.services ?? null,
        cep: user.cep ?? null,
        cepLat: user.cep_lat ?? null,
        cepLng: user.cep_lng ?? null,
        workCep: user.work_cep ?? null,
        workAddress: user.work_address ?? null,
        workLat: user.work_lat ?? null,
        workLng: user.work_lng ?? null,
        photoUrl: user.photo_url ?? null,
        passwordHash: user.password_hash,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      })
    );
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
        values.push(data.name.trim());
      }
      if (data.phone !== undefined) {
        updates.push(`phone = $${idx++}`);
        values.push(data.phone.trim());
      }
      if (data.address !== undefined) {
        updates.push(`address = $${idx++}`);
        values.push(data.address ?? null);
      }
      if (data.cep !== undefined) {
        const cep = geo.normalizeCep(data.cep);
        if (cep.length !== 8) {
          return reply.code(400).send({ message: "CEP invalido" });
        }
        const addressParts = [
          data.address ?? user.address,
          data.complement,
          data.neighborhood,
          data.city,
          data.state,
          cep,
        ].filter(Boolean);
        const fullAddress = addressParts.join(", ");
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

    return reply.send(
      sanitizeUser({
        id: fresh.id,
        role: fresh.role,
        name: fresh.name,
        email: fresh.email,
        phone: fresh.phone,
        address: fresh.address ?? null,
        cpf: fresh.cpf ?? null,
        radiusKm: fresh.radius_km ?? null,
        services: fresh.services ?? null,
        cep: fresh.cep ?? null,
        cepLat: fresh.cep_lat ?? null,
        cepLng: fresh.cep_lng ?? null,
        workCep: fresh.work_cep ?? null,
        workAddress: fresh.work_address ?? null,
        workLat: fresh.work_lat ?? null,
        workLng: fresh.work_lng ?? null,
        photoUrl: fresh.photo_url ?? null,
        passwordHash: fresh.password_hash,
        createdAt: fresh.created_at,
        updatedAt: fresh.updated_at,
      })
    );
  });
}
