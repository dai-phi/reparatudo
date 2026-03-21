import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool } from "../../../infrastructure/persistence/pool.js";
import { SERVICE_LABELS } from "../../../domain/value-objects/service-id.js";
import { formatCurrency, formatDate, formatRelativeTime } from "../../utils/format.js";

const ratingSchema = z.object({
  requestId: z.string().min(1),
  rating: z.number().min(1).max(5),
  review: z.string().optional().nullable(),
});

function statusMeta(status: string): { label: string; chatOpen: boolean } {
  switch (status) {
    case "open":
      return { label: "Aguardando prestador", chatOpen: true };
    case "accepted":
      return { label: "Em negociacao", chatOpen: true };
    case "confirmed":
      return { label: "Servico confirmado", chatOpen: true };
    case "completed":
      return { label: "Finalizado", chatOpen: false };
    case "cancelled":
      return { label: "Cancelado", chatOpen: false };
    case "rejected":
      return { label: "Recusado", chatOpen: false };
    default:
      return { label: status, chatOpen: false };
  }
}

export async function registerClientRoutes(app: FastifyInstance) {
  app.get("/client/requests", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const result = await pool.query(
      `SELECT r.id, r.service_id, r.description, r.status, r.created_at, r.updated_at, u.name as provider_name
       FROM requests r
       LEFT JOIN users u ON u.id = r.provider_id
       WHERE r.client_id = $1
       ORDER BY r.updated_at DESC`,
      [request.user.sub]
    );

    const items = result.rows.map((row) => {
      const meta = statusMeta(String(row.status));
      return {
        id: row.id,
        provider: row.provider_name ?? "Prestador",
        service: SERVICE_LABELS[row.service_id as keyof typeof SERVICE_LABELS] ?? row.service_id,
        desc: row.description || "Sem descricao",
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

    const result = await pool.query(
      `SELECT r.id, r.service_id, r.description, r.completed_at, r.updated_at, r.agreed_value,
              u.name as provider_name, ra.rating, ra.review
       FROM requests r
       LEFT JOIN users u ON u.id = r.provider_id
       LEFT JOIN ratings ra ON ra.request_id = r.id
       WHERE r.client_id = $1 AND r.status = 'completed'
       ORDER BY r.completed_at DESC NULLS LAST, r.updated_at DESC`,
      [request.user.sub]
    );

    const items = result.rows.map((row) => ({
      id: row.id,
      provider: row.provider_name ?? "Prestador",
      service: SERVICE_LABELS[row.service_id as keyof typeof SERVICE_LABELS] ?? row.service_id,
      desc: row.description || "Sem descricao",
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

    const targetResult = await pool.query(
      "SELECT id, client_id, provider_id, status FROM requests WHERE id = $1",
      [parsed.data.requestId]
    );
    const target = targetResult.rows[0];

    if (!target || target.client_id !== request.user.sub) {
      return reply.code(404).send({ message: "Servico nao encontrado" });
    }

    if (target.status !== "completed") {
      return reply.code(400).send({ message: "Servico ainda nao finalizado" });
    }

    if (!target.provider_id) {
      return reply.code(400).send({ message: "Prestador nao definido" });
    }

    const already = await pool.query("SELECT 1 FROM ratings WHERE request_id = $1", [target.id]);
    if (already.rowCount) {
      return reply.code(409).send({ message: "Servico ja avaliado" });
    }

    await pool.query(
      `INSERT INTO ratings (id, request_id, client_id, provider_id, rating, review, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        randomUUID(),
        target.id,
        request.user.sub,
        target.provider_id,
        parsed.data.rating,
        parsed.data.review?.trim() || null,
        new Date().toISOString(),
      ]
    );

    return reply.send({ ok: true });
  });
}
