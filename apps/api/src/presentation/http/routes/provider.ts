import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SERVICE_LABELS } from "../../../domain/value-objects/service-id.js";
import { formatCurrency, formatDate, formatRelativeTime } from "../../utils/format.js";
import { RequestStatusLabel, StatusEnum } from "../../../domain/value-objects/status-enum.js";
import { PostgresProviderRepository } from "../../../infrastructure/persistence/repository/postgres-provider-repository.js";
import { NO_DESCRIPTION } from "../../../domain/value-objects/messages.js";
import { CloudinaryService } from "../../../infrastructure/cloudinary/cloudinary-service.js";
import { destroyPublicIdIfAny } from "../utils/cloudinary-helpers.js";
import { assertProviderImageMime, assertProviderImageSize } from "../utils/image-upload.js";
import { getHttpStatusFromError, serializeUnknownError } from "../utils/serialize-error.js";

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

const verificationStatusSchema = z.enum(["unverified", "pending", "verified", "rejected"]);
const ratingResponseSchema = z.object({
  response: z.string().trim().min(5).max(800),
});
const adminDecisionSchema = z.object({
  status: z.enum(["verified", "rejected"]),
});
const adminQueueQuerySchema = z.object({
  status: verificationStatusSchema.optional().default("pending"),
});

function parseAdminKycAuth(headers: Record<string, unknown>): { ok: true } | { ok: false; reason: string } {
  const expectedRaw = process.env.ADMIN_KYC_KEY;
  const expected = expectedRaw?.trim();
  if (!expected) {
    return { ok: false, reason: "ADMIN_KYC_KEY nao configurada no servidor." };
  }

  const headerValue = headers["x-admin-key"];
  const raw = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, reason: "Envie a chave no header x-admin-key." };
  }

  const normalized = raw.replace(/^Bearer\s+/i, "").trim();
  if (normalized !== expected) {
    return { ok: false, reason: "Chave admin invalida." };
  }

  return { ok: true };
}

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
        desc: row.description || NO_DESCRIPTION,
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
        desc: row.description || NO_DESCRIPTION,
        date: formatDate(row.completed_at || row.updated_at),
        value: formatCurrency(agreedValue),
        ratingId: row.rating_id ?? null,
        rating: row.rating ? Number(row.rating) : 0,
        review: row.review ?? "",
        tags: Array.isArray(row.tags) ? row.tags : [],
        providerResponse: row.provider_response ?? "",
      };
    });

    return reply.send(items);
  });

  app.post("/provider/ratings/:id/response", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const parsed = ratingResponseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Dados invalidos", issues: parsed.error.flatten() });
    }

    const target = await providers.findRatingForProviderResponse(request.user.sub, String((request.params as { id: string }).id));
    if (!target) {
      return reply.code(404).send({ message: "Avaliacao nao encontrada" });
    }
    if (target.provider_response) {
      return reply.code(409).send({ message: "Resposta já registrada para esta avaliação" });
    }

    await providers.updateRatingProviderResponse({
      ratingId: target.id,
      response: parsed.data.response,
      now: new Date().toISOString(),
    });

    return reply.send({ ok: true });
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
      return reply.code(400).send({ message: "Voce ainda esta no periodo gratuito. Não e necessario pagar." });
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
      return reply.code(400).send({ message: "Não ha mensalidade em aberto no momento." });
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

  app.get("/provider/verification", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }
    const row = await providers.findVerificationByProviderId(request.user.sub);
    if (!row) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }
    if (row.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }
    const status = verificationStatusSchema.parse(row.verification_status ?? "unverified");
    return reply.send({
      status,
      documentUrl: row.verification_document_url ?? null,
      selfieUrl: row.verification_selfie_url ?? null,
      canSubmit: Boolean(row.verification_document_url && row.verification_selfie_url),
      isVerified: status === "verified",
    });
  });

  app.post("/provider/verification/document", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }
    const row = await providers.findVerificationByProviderId(request.user.sub);
    if (!row) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }
    const file = await request.file();
    if (!file || file.fieldname !== "document") {
      return reply.code(400).send({ message: 'Envie uma imagem no campo "document".' });
    }

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch (e) {
      const code = getHttpStatusFromError(e) ?? 413;
      return reply.code(code).send({ message: "Imagem muito grande ou inválida." });
    }

    try {
      assertProviderImageMime(file.mimetype);
      assertProviderImageSize(buffer.length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Imagem inválida";
      return reply.code(400).send({ message: msg });
    }

    let cloudinary: CloudinaryService;
    try {
      cloudinary = new CloudinaryService();
    } catch {
      return reply.code(500).send({ message: "Serviço de imagens não configurado." });
    }

    await destroyPublicIdIfAny(cloudinary, row.verification_document_storage_key ?? null);

    let uploaded;
    try {
      uploaded = await cloudinary.uploadBuffer(buffer, {
        folder: "teu-faz-tudo",
        public_id: `verification/document-${request.user.sub}`,
        overwrite: true,
        resource_type: "image",
      });
    } catch (e) {
      return reply.code(502).send({ message: serializeUnknownError(e) });
    }

    const parsedStatus = verificationStatusSchema.parse(row.verification_status ?? "unverified");
    await providers.updateVerificationAssets(request.user.sub, {
      verificationDocumentUrl: uploaded.secure_url,
      verificationDocumentStorageKey: uploaded.public_id,
      verificationStatus: parsedStatus === "rejected" ? "unverified" : parsedStatus,
    });

    return reply.code(201).send({
      documentUrl: uploaded.secure_url,
      status: parsedStatus === "rejected" ? "unverified" : parsedStatus,
    });
  });

  app.post("/provider/verification/selfie", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }
    const row = await providers.findVerificationByProviderId(request.user.sub);
    if (!row) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }
    const file = await request.file();
    if (!file || file.fieldname !== "selfie") {
      return reply.code(400).send({ message: 'Envie uma imagem no campo "selfie".' });
    }

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch (e) {
      const code = getHttpStatusFromError(e) ?? 413;
      return reply.code(code).send({ message: "Imagem muito grande ou inválida." });
    }

    try {
      assertProviderImageMime(file.mimetype);
      assertProviderImageSize(buffer.length);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Imagem inválida";
      return reply.code(400).send({ message: msg });
    }

    let cloudinary: CloudinaryService;
    try {
      cloudinary = new CloudinaryService();
    } catch {
      return reply.code(500).send({ message: "Serviço de imagens não configurado." });
    }

    await destroyPublicIdIfAny(cloudinary, row.verification_selfie_storage_key ?? null);

    let uploaded;
    try {
      uploaded = await cloudinary.uploadBuffer(buffer, {
        folder: "teu-faz-tudo",
        public_id: `verification/selfie-${request.user.sub}`,
        overwrite: true,
        resource_type: "image",
      });
    } catch (e) {
      return reply.code(502).send({ message: serializeUnknownError(e) });
    }

    const parsedStatus = verificationStatusSchema.parse(row.verification_status ?? "unverified");
    await providers.updateVerificationAssets(request.user.sub, {
      verificationSelfieUrl: uploaded.secure_url,
      verificationSelfieStorageKey: uploaded.public_id,
      verificationStatus: parsedStatus === "rejected" ? "unverified" : parsedStatus,
    });

    return reply.code(201).send({
      selfieUrl: uploaded.secure_url,
      status: parsedStatus === "rejected" ? "unverified" : parsedStatus,
    });
  });

  app.post("/provider/verification/submit", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }
    const row = await providers.findVerificationByProviderId(request.user.sub);
    if (!row) {
      return reply.code(404).send({ message: "Usuario nao encontrado" });
    }
    const status = verificationStatusSchema.parse(row.verification_status ?? "unverified");
    if (!row.verification_document_url || !row.verification_selfie_url) {
      return reply.code(400).send({ message: "Envie documento e selfie antes de solicitar verificação." });
    }
    if (status === "verified") {
      return reply.code(400).send({ message: "Sua conta já está verificada." });
    }
    await providers.updateVerificationAssets(request.user.sub, { verificationStatus: "pending" });
    return reply.send({ status: "pending" as const, message: "Verificação enviada para análise." });
  });

  app.get("/admin/provider-verifications", async (request, reply) => {
    const auth = parseAdminKycAuth(request.headers as Record<string, unknown>);
    if (!auth.ok) {
      return reply.code(401).send({ message: auth.reason });
    }
    const parsed = adminQueueQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Parametros invalidos", issues: parsed.error.flatten() });
    }
    const rows = await providers.listVerificationQueue(parsed.data.status);
    return reply.send(
      rows.map((r) => ({
        providerId: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        cpf: r.cpf,
        status: r.verification_status,
        documentUrl: r.verification_document_url ?? null,
        selfieUrl: r.verification_selfie_url ?? null,
        updatedAt: r.updated_at,
      }))
    );
  });

  app.post("/admin/provider-verifications/:providerId/decision", async (request, reply) => {
    const auth = parseAdminKycAuth(request.headers as Record<string, unknown>);
    if (!auth.ok) {
      return reply.code(401).send({ message: auth.reason });
    }
    const paramsSchema = z.object({ providerId: z.string().uuid() });
    const paramsParsed = paramsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.code(400).send({ message: "Parametros invalidos", issues: paramsParsed.error.flatten() });
    }
    const bodyParsed = adminDecisionSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.code(400).send({ message: "Dados invalidos", issues: bodyParsed.error.flatten() });
    }

    const row = await providers.findVerificationByProviderId(paramsParsed.data.providerId);
    if (!row) {
      return reply.code(404).send({ message: "Prestador nao encontrado" });
    }
    if (row.role !== "provider") {
      return reply.code(400).send({ message: "Usuario informado nao e prestador" });
    }
    if (!row.verification_document_url || !row.verification_selfie_url) {
      return reply.code(400).send({ message: "Prestador sem documentos completos para decisao." });
    }

    await providers.updateVerificationAssets(paramsParsed.data.providerId, {
      verificationStatus: bodyParsed.data.status,
    });
    return reply.send({
      providerId: paramsParsed.data.providerId,
      status: bodyParsed.data.status,
      message: bodyParsed.data.status === "verified" ? "Prestador aprovado com sucesso." : "Prestador reprovado com sucesso.",
    });
  });
}
