import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { SERVICE_LABELS } from "../services.js";
import { formatCurrency, formatRelativeTime } from "../utils.js";

export async function registerProviderRoutes(app: FastifyInstance) {
  app.get("/provider/requests", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const result = await pool.query(
      `SELECT r.id, r.service_id, r.description, r.created_at, r.status, u.name as client_name
       FROM requests r
       LEFT JOIN users u ON u.id = r.client_id
       WHERE r.provider_id = $1 AND r.status IN ('open', 'accepted')
       ORDER BY r.created_at DESC`,
      [request.user.sub]
    );

    const items = result.rows.map((row) => ({
      id: row.id,
      client: row.client_name ?? "Cliente",
      service: SERVICE_LABELS[row.service_id as keyof typeof SERVICE_LABELS] ?? row.service_id,
      desc: row.description || "Sem descricao",
      distance: "2.3 km",
      time: formatRelativeTime(row.created_at),
      status: row.status,
    }));

    return reply.send(items);
  });

  app.get("/provider/stats", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const completedResult = await pool.query(
      `SELECT COUNT(*)::int as total, COALESCE(SUM(agreed_value), 0) as earnings
       FROM requests
       WHERE provider_id = $1 AND status = 'completed'`,
      [request.user.sub]
    );

    const ratingResult = await pool.query(
      `SELECT AVG(rating) as rating_avg
       FROM ratings
       WHERE provider_id = $1`,
      [request.user.sub]
    );

    const completed = completedResult.rows[0];
    const total = Number(completed?.total || 0);
    const ratingAvg = ratingResult.rows[0]?.rating_avg ? Number(ratingResult.rows[0].rating_avg) : 0;
    const earnings = Number(completed?.earnings || 0);

    return reply.send({
      attendedCount: total,
      ratingAvg,
      monthEarnings: earnings,
      monthEarningsLabel: formatCurrency(earnings),
      avgResponseMins: total > 0 ? 35 : 0,
    });
  });
}
