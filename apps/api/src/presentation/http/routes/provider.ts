import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SERVICE_LABELS } from "../../../domain/value-objects/service-id.js";
import { formatCurrency, formatDate, formatRelativeTime } from "../../utils/format.js";
import { RequestStatusLabel, StatusEnum } from "../../../domain/value-objects/status-enum.js";
import { PostgresProviderRepository } from "../../../infrastructure/persistence/postgres-provider-repository.js";

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

function providerRequestStatusLabel(status: string): string {
  switch (status) {
    case StatusEnum.CONFIRMED:
      return RequestStatusLabel.IN_SERVICE;
    case StatusEnum.ACCEPTED:
      return RequestStatusLabel.IN_NEGOTIATION;
    case StatusEnum.OPEN:
      return RequestStatusLabel.NEW;
    default:
      return status;
  }
}

function providerPendingStepLabel(status: string, providerConfirmed: boolean, clientConfirmed: boolean): string | null {
  if (status !== StatusEnum.ACCEPTED) return null;
  if (providerConfirmed && !clientConfirmed) {
    return "Voce já confirmou o serviço. Aguardando o cliente.";
  }
  if (!providerConfirmed && clientConfirmed) {
    return "Cliente ja confirmou o serviço. Falta sua confirmação.";
  }
  if (!providerConfirmed && !clientConfirmed) {
    return "Serviço aceito. Falta confirmar com o cliente.";
  }
  return null;
}

export async function registerProviderRoutes(
  app: FastifyInstance,
  providers: PostgresProviderRepository = new PostgresProviderRepository()
) {
  app.get("/provider/requests", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const result = await providers.listActiveRequests(request.user.sub);

    const items = result.map((row) => {
      const status = String(row.status);
      const providerConfirmed = Boolean(row.provider_confirmed);
      const clientConfirmed = Boolean(row.client_confirmed);
      return {
        id: row.id,
        client: row.client_name ?? "Cliente",
        service: SERVICE_LABELS[row.service_id as keyof typeof SERVICE_LABELS] ?? row.service_id,
        desc: row.description || "Sem descrição",
        distance: "2.3 km",
        time: formatRelativeTime(row.updated_at || row.created_at),
        status,
        statusLabel: providerRequestStatusLabel(status),
        pendingStepLabel: providerPendingStepLabel(status, providerConfirmed, clientConfirmed),
        value: formatCurrency(Number(row.agreed_value || 0)),
        providerConfirmed,
        clientConfirmed,
      };
    });

    return reply.send(items);
  });

  app.get("/provider/stats", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const stats = await providers.getCompletedStats(request.user.sub);

    const completed = stats.completed;
    const total = Number(completed?.total || 0);
    const ratingAvg = stats.rating?.rating_avg ? Number(stats.rating.rating_avg) : 0;
    const earnings = Number(completed?.earnings || 0);

    return reply.send({
      attendedCount: total,
      ratingAvg,
      monthEarnings: earnings,
      monthEarningsLabel: formatCurrency(earnings),
      avgResponseMins: total > 0 ? 35 : 0,
    });
  });

  app.get("/provider/history", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const result = await providers.listHistory(request.user.sub);

    const items = result.map((row) => {
      const agreedValue = Number(row.agreed_value || 0);
      return {
        id: row.id,
        client: row.client_name ?? "Cliente",
        service: SERVICE_LABELS[row.service_id as keyof typeof SERVICE_LABELS] ?? row.service_id,
        desc: row.description || "Sem descrição",
        date: formatDate(row.completed_at || row.updated_at),
        value: formatCurrency(agreedValue),
      };
    });

    return reply.send(items);
  });

  app.get("/provider/billing/summary", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const row = await providers.findProviderCreatedAt(request.user.sub);
    if (!row) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    const createdAt = new Date(row.created_at);
    const freeEndsAt = addMonths(createdAt, FREE_TRIAL_MONTHS);
    const now = new Date();
    const inFreePeriod = now < freeEndsAt;

    const paidResult = await providers.listPaidReferenceMonths(request.user.sub);
    const paidSet = new Set<string>(paidResult.map((r) => monthKeyFromDb(r.k)));

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

    const result = await providers.listPayments(request.user.sub);

    const items = result.map((r) => {
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

    const urow = await providers.findProviderCreatedAt(request.user.sub);
    if (!urow) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }

    const createdAt = new Date(urow.created_at);
    const freeEndsAt = addMonths(createdAt, FREE_TRIAL_MONTHS);
    const now = new Date();
    if (now < freeEndsAt) {
      return reply.code(400).send({ message: "Voce ainda esta no periodo gratuito. Nao e necessario pagar." });
    }

    const paidResult = await providers.listPaidReferenceMonthsRaw(request.user.sub);
    const paidSet = new Set<string>(paidResult.map((r) => monthKeyFromDb(r.reference_month)));

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

    await providers.insertPayment({
      id,
      providerId: request.user.sub,
      amount: fee,
      paymentMethod,
      referenceMonth: competenciaKey,
      paidAt: ts,
      pixCopyPaste,
      cardLastFour: paymentMethod === "pix" ? null : cardLastFour ?? null,
      createdAt: ts,
      updatedAt: ts,
    });

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
