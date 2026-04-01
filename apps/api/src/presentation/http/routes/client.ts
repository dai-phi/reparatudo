import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { mapClientHistoryRow, mapClientRequestRow } from "../../../application/client/client-request-mappers.js";
import { submitClientRating } from "../../../application/client/submit-client-rating.js";
import type { IClientRepository } from "../../../domain/ports/client-repository.js";

const ratingSchema = z.object({
  requestId: z.string().min(1),
  rating: z.number().min(1).max(5),
  review: z.string().optional().nullable(),
  tags: z.array(z.enum(["pontual", "limpo", "educado", "comunicativo", "resolutivo"])).max(5).optional(),
});

export async function registerClientRoutes(app: FastifyInstance, clients: IClientRepository) {
  app.get("/client/requests", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const result = await clients.listRequests(request.user.sub);
    const items = result.map((row) => mapClientRequestRow(row));

    return reply.send(items);
  });

  app.get("/client/history", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const result = await clients.listHistory(request.user.sub);
    const items = result.map((row) => mapClientHistoryRow(row));

    return reply.send(items);
  });

  app.post("/client/ratings", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const parsed = ratingSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Dados invalidos", issues: parsed.error.flatten() });
    }

    const d = parsed.data;
    const result = await submitClientRating(
      { clients },
      {
        clientId: request.user.sub,
        input: {
          requestId: d.requestId,
          rating: d.rating,
          review: d.review,
          tags: d.tags,
        },
      }
    );

    if (result.ok === false) {
      return reply.code(result.status).send({ message: result.message });
    }

    return reply.send({ ok: true });
  });
}
