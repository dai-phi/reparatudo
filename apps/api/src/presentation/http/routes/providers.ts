import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../../../infrastructure/persistence/pool.js";
import { PostgresGeoService } from "../../../infrastructure/geo/postgresGeoService.js";
import { SERVICE_IDS } from "../../../domain/value-objects/service-id.js";

const geo = new PostgresGeoService();

const querySchema = z.object({
  serviceId: z.enum(SERVICE_IDS),
});

export async function registerProviderSearchRoutes(app: FastifyInstance) {
  app.get("/providers", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Parametros invalidos", issues: parsed.error.flatten() });
    }

    const clientResult = await pool.query("SELECT cep, cep_lat, cep_lng FROM users WHERE id = $1", [
      request.user.sub,
    ]);
    const client = clientResult.rows[0];

    if (!client?.cep_lat || !client?.cep_lng) {
      return reply.code(400).send({ message: "CEP do cliente nao cadastrado" });
    }

    const providerResult = await pool.query(
      `SELECT u.id, u.name, u.photo_url, u.radius_km, u.work_lat, u.work_lng,
              u.last_service_lat, u.last_service_lng, u.last_service_at,
              COALESCE(AVG(r.rating), 0) as rating_avg,
              COALESCE(AVG(EXTRACT(EPOCH FROM (req.accepted_at - req.created_at)) / 60), 9999) as avg_response
       FROM users u
       LEFT JOIN ratings r ON r.provider_id = u.id
       LEFT JOIN requests req ON req.provider_id = u.id AND req.accepted_at IS NOT NULL
       WHERE u.role = 'provider' AND $1 = ANY(u.services)
       GROUP BY u.id
       ORDER BY avg_response ASC`,
      [parsed.data.serviceId]
    );

    const clientCoords = { lat: Number(client.cep_lat), lng: Number(client.cep_lng) };

    const providers = providerResult.rows
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

    return reply.send(providers);
  });
}
