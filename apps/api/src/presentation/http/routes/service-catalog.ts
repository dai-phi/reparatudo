import type { FastifyInstance } from "fastify";
import { SERVICE_IDS, SERVICE_LABELS } from "../../../domain/value-objects/service-id.js";
import { SERVICE_SUBTYPE_CATALOG } from "../../../domain/value-objects/service-subtype-catalog.js";

/** Public read-only catalog so clients stay aligned with API validation (labels in PT). */
export async function registerServiceCatalogRoutes(app: FastifyInstance) {
  app.get("/catalog/services", async (_request, reply) => {
    return reply.send({
      services: SERVICE_IDS.map((id) => ({
        id,
        labelPt: SERVICE_LABELS[id],
        subtypes: SERVICE_SUBTYPE_CATALOG[id],
      })),
    });
  });
}
