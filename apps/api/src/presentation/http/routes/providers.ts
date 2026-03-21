import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PostgresGeoService } from "../../../infrastructure/geo/postgres-geo-service.js";
import { SERVICE_IDS } from "../../../domain/value-objects/service-id.js";
import { PostgresProviderSearchRepository } from "../../../infrastructure/persistence/repository/postgres-provider-search-repository.js";

const geo = new PostgresGeoService();

const querySchema = z.object({
  serviceId: z.enum(SERVICE_IDS),
});

export async function registerProviderSearchRoutes(
  app: FastifyInstance,
  providers: PostgresProviderSearchRepository = new PostgresProviderSearchRepository()
) {
  app.get("/providers", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Parametros invalidos", issues: parsed.error.flatten() });
    }

    const client = await providers.findClientCoords(request.user.sub);

    if (!client?.cep_lat || !client?.cep_lng) {
      return reply.code(400).send({ message: "CEP do cliente nao cadastrado" });
    }

    const providerResult = await providers.listProvidersByService(parsed.data.serviceId);

    const clientCoords = { lat: Number(client.cep_lat), lng: Number(client.cep_lng) };

    const providersByDistance = providerResult
      .map((row) => {
        const distance =
          row.work_lat && row.work_lng
            ? geo.distanceKm(clientCoords, { lat: Number(row.work_lat), lng: Number(row.work_lng) })
            : null;
        const lastServiceKm =
          row.last_service_lat != null && row.last_service_lng != null
            ? geo.distanceKm(clientCoords, { lat: Number(row.last_service_lat), lng: Number(row.last_service_lng) })
            : null;
        return {
          id: row.id,
          name: row.name,
          photoUrl: row.photo_url || null,
          rating: Number(row.rating_avg || 0),
          avgResponseMins: Math.round(Number(row.avg_response || 0)),
          distanceKm: distance !== null ? Number(distance.toFixed(1)) : null,
          lastServiceDistanceKm: lastServiceKm !== null ? Number(lastServiceKm.toFixed(1)) : null,
          lastServiceAt: row.last_service_at || null,
          radiusKm: row.radius_km ? Number(row.radius_km) : 0,
        };
      })
      .filter((provider) => {
        if (provider.distanceKm === null) return false;
        if (!provider.radiusKm) return false;
        return provider.distanceKm <= provider.radiusKm;
      })
      .sort((a, b) => a.avgResponseMins - b.avgResponseMins);

    return reply.send(providersByDistance);
  });
}
