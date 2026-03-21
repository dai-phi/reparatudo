import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../../../infrastructure/persistence/pool.js";
import { SERVICE_LABELS } from "../../../domain/value-objects/service-id.js";
import { formatCurrency, formatDate, formatRelativeTime } from "../../utils/format.js";

const FREE_TRIAL_MONTHS = 2;

function monthlyFeeBrl(): number {
  const raw = process.env.PROVIDER_MONTHLY_FEE;
  if (raw == null || raw === "") {
    return 49.9;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 49.9;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function monthKeyFromDb(raw: unknown): string {
  if (raw == null) return "";
  if (raw instanceof Date) {
    return monthKey(startOfMonth(raw));
  }
  const s = String(raw).slice(0, 10);
  const parts = s.split("-");
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1].padStart(2, "0")}-01`;
  }
  return s;
}

function monthsRangeInclusive(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  let cur = startOfMonth(from);
  const end = startOfMonth(to);
  while (cur <= end) {
    out.push(new Date(cur));
    cur = addMonths(cur, 1);
  }
  return out;
}

const createPaymentSchema = z.object({
  paymentMethod: z.enum(["pix", "cartao_credito", "cartao_debito"]),
  cardLastFour: z.string().regex(/^\d{4}$/).optional(),
});

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

  app.get("/provider/billing/summary", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const userResult = await pool.query(`SELECT created_at FROM users WHERE id = $1 AND role = 'provider'`, [request.user.sub]);
    const row = userResult.rows[0];
    if (!row) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    const createdAt = new Date(row.created_at);
    const freeEndsAt = addMonths(createdAt, FREE_TRIAL_MONTHS);
    const now = new Date();
    const inFreePeriod = now < freeEndsAt;

    const paidResult = await pool.query(
      `SELECT reference_month::text as k FROM provider_payments
       WHERE provider_id = $1 AND status = 'paid'`,
      [request.user.sub]
    );
    const paidSet = new Set<string>(paidResult.rows.map((r) => monthKeyFromDb(r.k)));

    const unpaidMonths: { referenceMonth: string; label: string }[] = [];
    if (!inFreePeriod) {
      const firstBillMonth = startOfMonth(freeEndsAt);
      const currentMonth = startOfMonth(now);
      for (const m of monthsRangeInclusive(firstBillMonth, currentMonth)) {
        const key = monthKey(m);
        if (!paidSet.has(key)) {
          unpaidMonths.push({
            referenceMonth: key,
            label: new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(m),
          });
        }
      }
    }

    const fee = monthlyFeeBrl();
    return reply.send({
      monthlyFee: fee,
      monthlyFeeLabel: formatCurrency(fee),
      freeTrialMonths: FREE_TRIAL_MONTHS,
      freeEndsAt: freeEndsAt.toISOString(),
      inFreePeriod,
      freeEndsAtLabel: formatDate(freeEndsAt.toISOString()),
      unpaidMonths,
      hasOutstanding: unpaidMonths.length > 0,
    });
  });

  app.get("/provider/billing/payments", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const result = await pool.query(
      `SELECT id, amount, payment_method, status, reference_month, paid_at, pix_copy_paste, card_last_four, created_at
       FROM provider_payments WHERE provider_id = $1 ORDER BY paid_at DESC, created_at DESC`,
      [request.user.sub]
    );

    const items = result.rows.map((r) => {
      const amount = Number(r.amount);
      return {
        id: r.id,
        amount,
        amountLabel: formatCurrency(amount),
        paymentMethod: r.payment_method as "pix" | "cartao_credito" | "cartao_debito",
        status: r.status as "pending" | "paid" | "cancelled",
        referenceMonth: r.reference_month,
        referenceMonthLabel: new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(r.reference_month)),
        paidAt: r.paid_at,
        paidAtLabel: formatDate(r.paid_at),
        pixCopyPaste: r.pix_copy_paste ?? null,
        cardLastFour: r.card_last_four ?? null,
        createdAt: r.created_at,
      };
    });

    return reply.send(items);
  });

  app.post("/provider/billing/payments", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const parsed = createPaymentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Dados invalidos", issues: parsed.error.flatten() });
    }

    const { paymentMethod, cardLastFour } = parsed.data;
    if ((paymentMethod === "cartao_credito" || paymentMethod === "cartao_debito") && !cardLastFour) {
      return reply.code(400).send({ message: "Informe os ultimos 4 digitos do cartao" });
    }

    const userResult = await pool.query(`SELECT created_at FROM users WHERE id = $1 AND role = 'provider'`, [request.user.sub]);
    const urow = userResult.rows[0];
    if (!urow) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    const createdAt = new Date(urow.created_at);
    const freeEndsAt = addMonths(createdAt, FREE_TRIAL_MONTHS);
    const now = new Date();
    if (now < freeEndsAt) {
      return reply.code(400).send({ message: "Voce ainda esta no periodo gratuito. Nao e necessario pagar." });
    }

    const paidResult = await pool.query(
      `SELECT reference_month FROM provider_payments WHERE provider_id = $1 AND status = 'paid'`,
      [request.user.sub]
    );
    const paidSet = new Set<string>(paidResult.rows.map((r) => monthKeyFromDb(r.reference_month)));

    const firstBillMonth = startOfMonth(freeEndsAt);
    const currentMonth = startOfMonth(now);
    let targetMonth: Date | null = null;
    for (const m of monthsRangeInclusive(firstBillMonth, currentMonth)) {
      const key = monthKey(m);
      if (!paidSet.has(key)) {
        targetMonth = m;
        break;
      }
    }

    if (!targetMonth) {
      return reply.code(400).send({ message: "Nao ha mensalidade em aberto no momento." });
    }

    const id = randomUUID();
    const ts = now.toISOString();
    const competenciaKey = monthKey(targetMonth);
    const fee = monthlyFeeBrl();
    const feeCents = Math.round(fee * 100);

    let pixCopyPaste: string | null = null;
    if (paymentMethod === "pix") {
      const payload = `00020126580014br.gov.bcb.pix0136${randomUUID().replace(/-/g, "")}520400005303986540${String(feeCents).padStart(10, "0")}5802BR5925REP TUDO SISTEMAS6009SAO PAULO62070503***6304`;
      pixCopyPaste = payload.slice(0, 180);
    }

    await pool.query(
      `INSERT INTO provider_payments (id, provider_id, amount, payment_method, status, reference_month, paid_at, pix_copy_paste, card_last_four, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'paid', $5, $6, $7, $8, $9, $10)`,
      [
        id,
        request.user.sub,
        fee,
        paymentMethod,
        competenciaKey,
        ts,
        pixCopyPaste,
        paymentMethod === "pix" ? null : cardLastFour ?? null,
        ts,
        ts,
      ]
    );

    return reply.code(201).send({
      id,
      amount: fee,
      amountLabel: formatCurrency(fee),
      paymentMethod,
      status: "paid" as const,
      referenceMonth: competenciaKey,
      referenceMonthLabel: new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(targetMonth),
      paidAt: ts,
      paidAtLabel: formatDate(ts),
      pixCopyPaste,
      cardLastFour: paymentMethod === "pix" ? null : cardLastFour ?? null,
    });
  });
}
