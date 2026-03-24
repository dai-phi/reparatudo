import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { SERVICE_LABELS } from "../../../domain/value-objects/service-id.js";
import { formatCurrency, formatDate, formatRelativeTime } from "../../utils/format.js";
import { PostgresClientRepository } from "../../../infrastructure/persistence/repository/postgres-client-repository.js";
import { RequestStatusLabel, StatusEnum } from "../../../domain/value-objects/status-enum.js";

const ratingSchema = z.object({
  requestId: z.string().min(1),
  rating: z.number().min(1).max(5),
  review: z.string().optional().nullable(),
});

function statusMeta(status: string): { label: string; chatOpen: boolean } {
  switch (status) {
    case StatusEnum.OPEN:
      return { label: RequestStatusLabel.WAITING_PROVIDER, chatOpen: true };
    case StatusEnum.ACCEPTED:
      return { label: "Em negociação", chatOpen: true };
    case StatusEnum.CONFIRMED:
      return { label: "Serviço confirmado", chatOpen: true };
    case StatusEnum.COMPLETED:
      return { label: "Finalizado", chatOpen: false };
    case StatusEnum.CANCELLED:
      return { label: "Cancelado", chatOpen: false };
    case StatusEnum.REJECTED:
      return { label: "Recusado", chatOpen: false };
    default:
      return { label: status, chatOpen: false };
  }
}

export async function registerClientRoutes(
  app: FastifyInstance,
  clients: PostgresClientRepository = new PostgresClientRepository()
) {
  app.get("/client/requests", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const result = await clients.listRequests(request.user.sub);

    const items = result.map((row) => {
      const meta = statusMeta(String(row.status));
      return {
        id: row.id,
        provider: row.provider_name ?? "Prestador",
        service: SERVICE_LABELS[row.service_id as keyof typeof SERVICE_LABELS] ?? row.service_id,
        desc: row.description || "Sem descrição",
        status: String(row.status),
        statusLabel: meta.label,
        chatOpen: meta.chatOpen,
        time: formatRelativeTime(row.updated_at),
      };
    });

    return reply.send(items);
  });

  app.get("/client/history", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const result = await clients.listHistory(request.user.sub);

    const items = result.map((row) => ({
      id: row.id,
      provider: row.provider_name ?? "Prestador",
      service: SERVICE_LABELS[row.service_id as keyof typeof SERVICE_LABELS] ?? row.service_id,
      desc: row.description || "Sem descrição",
      date: formatDate(row.completed_at || row.updated_at),
      value: formatCurrency(Number(row.agreed_value || 0)),
      rated: Boolean(row.rating),
      rating: row.rating ? Number(row.rating) : 0,
      review: row.review || "",
    }));

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

    const target = await clients.findRequestForRating(parsed.data.requestId);

    if (!target || target.client_id !== request.user.sub) {
      return reply.code(404).send({ message: "Serviço nao encontrado" });
    }

    if (target.status !== "completed") {
      return reply.code(400).send({ message: "Serviço ainda nao finalizado" });
    }

    if (!target.provider_id) {
      return reply.code(400).send({ message: "Prestador não definido" });
    }

    const already = await clients.hasRating(target.id);
    if (already) {
      return reply.code(409).send({ message: "Serviço já avaliado" });
    }

    await clients.insertRating({
      id: randomUUID(),
      requestId: target.id,
      clientId: request.user.sub,
      providerId: target.provider_id,
      rating: parsed.data.rating,
      review: parsed.data.review?.trim() || null,
      createdAt: new Date().toISOString(),
    });

    return reply.send({ ok: true });
  });
}
