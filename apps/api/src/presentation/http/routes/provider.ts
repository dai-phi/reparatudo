import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { IAuditLogWriter } from "../../../domain/ports/audit-log-writer.js";
import { SERVICE_LABELS } from "../../../domain/value-objects/service-id.js";
import { formatCurrency, formatDate, formatRelativeTime } from "../../utils/format.js";
import { RequestStatusLabel, StatusEnum } from "../../../domain/value-objects/status-enum.js";
import { PostgresProviderRepository } from "../../../infrastructure/persistence/repository/postgres-provider-repository.js";
import { NO_DESCRIPTION } from "../../../domain/value-objects/messages.js";
import { CloudinaryService } from "../../../infrastructure/cloudinary/cloudinary-service.js";
import { destroyPublicIdIfAny } from "../utils/cloudinary-helpers.js";
import { assertProviderImageMime, assertProviderImageSize } from "../utils/image-upload.js";
import { getHttpStatusFromError, serializeUnknownError } from "../utils/serialize-error.js";
import { hashIpForAudit, userAgentSnippet } from "../utils/audit-request-context.js";
import { safeAuditAppend } from "../utils/safe-audit.js";

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
import {
  PROVIDER_PLAN_IDS,
  PROVIDER_PLAN_PAYMENT_METHODS,
  type ProviderPlanId,
} from "../../../domain/value-objects/provider-plan.js";

const createPlanPurchaseSchema = z.object({
  planId: z.enum(PROVIDER_PLAN_IDS),
  paymentMethod: z.enum(PROVIDER_PLAN_PAYMENT_METHODS),
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
  const expected = process.env.ADMIN_KYC_KEY?.trim();
  if (!expected) {
    return { ok: false, reason: "ADMIN_KYC_KEY nao configurada no servidor." };
  }

  const headerValue = headers["x-admin-key"];
  const received =
    typeof headerValue === "string"
      ? headerValue.trim()
      : Array.isArray(headerValue)
        ? headerValue.find((value): value is string => typeof value === "string")?.trim() ?? ""
        : "";

  if (!received) {
    return { ok: false, reason: 'Header "x-admin-key" nao informado.' };
  }

  if (received !== expected) {
    return { ok: false, reason: "Chave admin KYC invalida." };
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
    return "Voce ja confirmou o servico. Aguardando o cliente.";
  }
  if (!providerConfirmed && clientConfirmed) {
    return "Cliente ja confirmou o servico. Falta sua confirmacao.";
  }
  if (!providerConfirmed && !clientConfirmed) {
    return "Servico aceito. Falta confirmar com o cliente.";
  }
  return null;
}

function buildPlanPayload(row: Record<string, unknown>, currentPlanId: string | null) {
  const planId = String(row.id);
  const price = Number(row.price || 0);

  return {
    id: planId,
    code: String(row.code),
    name: String(row.name),
    description: String(row.description),
    price,
    priceLabel: formatCurrency(price),
    billingCycleDays: Number(row.billing_cycle_days || 30),
    features: Array.isArray(row.features) ? row.features.map((feature) => String(feature)) : [],
    isCurrent: currentPlanId === planId,
  };
}

function buildCurrentSubscriptionPayload(row: Record<string, unknown> | null) {
  if (!row) return null;

  const price = Number(row.price || 0);
  const startsAt = String(row.starts_at);
  const expiresAt = String(row.expires_at);
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    planId: String(row.plan_id),
    planCode: String(row.plan_code),
    planName: String(row.plan_name),
    planDescription: String(row.plan_description),
    status: String(row.status),
    startsAt,
    startsAtLabel: formatDate(startsAt),
    expiresAt,
    expiresAtLabel: formatDate(expiresAt),
    daysRemaining,
    price,
    priceLabel: formatCurrency(price),
    billingCycleDays: Number(row.billing_cycle_days || 30),
    features: Array.isArray(row.features) ? row.features.map((feature) => String(feature)) : [],
  };
}

function buildPlanPaymentPayload(row: Record<string, unknown>) {
  const amount = Number(row.amount || 0);
  const paidAt = row.paid_at ? String(row.paid_at) : null;
  const coverageStartsAt = String(row.coverage_starts_at);
  const coverageEndsAt = String(row.coverage_ends_at);

  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    planId: String(row.plan_id),
    planCode: String(row.plan_code),
    planName: String(row.plan_name),
    subscriptionId: String(row.subscription_id),
    amount,
    amountLabel: formatCurrency(amount),
    currency: String(row.currency || "BRL"),
    paymentMethod: String(row.payment_method),
    status: String(row.status),
    coverageStartsAt,
    coverageStartsAtLabel: formatDate(coverageStartsAt),
    coverageEndsAt,
    coverageEndsAtLabel: formatDate(coverageEndsAt),
    paidAt,
    paidAtLabel: paidAt ? formatDate(paidAt) : null,
    pixCopyPaste: row.pix_copy_paste ? String(row.pix_copy_paste) : null,
    cardLastFour: row.card_last_four ? String(row.card_last_four) : null,
    mockTransactionId: String(row.mock_transaction_id),
    createdAt: String(row.created_at),
  };
}

function buildMockPixCopyPaste(planId: ProviderPlanId, amount: number, transactionId: string) {
  const amountInCents = Math.round(amount * 100);
  return `PIX|MOCK|plan=${planId}|amount=${amountInCents}|tx=${transactionId}`;
}

function clientIpFromRequest(request: import("fastify").FastifyRequest): string {
  const raw = request.ip || request.socket.remoteAddress || "";
  return String(raw).replace(/^::ffff:/, "") || "unknown";
}

export type ProviderRouteExtraDeps = {
  audit?: IAuditLogWriter;
};

export async function registerProviderRoutes(
  app: FastifyInstance,
  providers: PostgresProviderRepository = new PostgresProviderRepository(),
  extra?: ProviderRouteExtraDeps
) {
  const auditSecret = process.env.JWT_SECRET || "dev-secret";
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

    app.get("/provider/plans", { preHandler: [app.authenticate] }, async (request, reply) => {
        if (request.user.role !== "provider") {
            return reply.code(403).send({ message: "Acesso negado" });
        }

        const currentAt = new Date().toISOString();
        await providers.refreshExpiredPlanSubscriptions(request.user.sub, currentAt);

        const [plans, currentSubscription] = await Promise.all([
            providers.listPlans(),
            providers.findCurrentPlanSubscription(request.user.sub),
        ]);

        return reply.send({
            plans: plans.map((plan) => buildPlanPayload(plan, currentSubscription ? String(currentSubscription.plan_id) : null)),
            currentSubscription: buildCurrentSubscriptionPayload(currentSubscription),
        });
    });
  app.get("/provider/billing/summary", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const currentAt = new Date().toISOString();
    await providers.refreshExpiredPlanSubscriptions(request.user.sub, currentAt);

    const [plans, currentSubscription] = await Promise.all([
      providers.listPlans(),
      providers.findCurrentPlanSubscription(request.user.sub),
    ]);

    return reply.send({
      plans: plans.map((plan) => buildPlanPayload(plan, currentSubscription ? String(currentSubscription.plan_id) : null)),
      currentSubscription: buildCurrentSubscriptionPayload(currentSubscription),
    });
  });

  app.get("/provider/plans/payments", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const currentAt = new Date().toISOString();
    await providers.refreshExpiredPlanSubscriptions(request.user.sub, currentAt);

    const result = await providers.listPlanPayments(request.user.sub);
    return reply.send(result.map((row) => buildPlanPaymentPayload(row)));
  });

  app.post("/provider/plans/subscribe", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const parsed = createPlanPurchaseSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Dados invalidos", issues: parsed.error.flatten() });
    }

    const { planId, paymentMethod, cardLastFour } = parsed.data;
    if ((paymentMethod === "credit_card" || paymentMethod === "debit_card") && !cardLastFour) {
      return reply.code(400).send({ message: "Informe os ultimos 4 digitos do cartao" });
    }

    const plan = await providers.findPlanById(planId);
    if (!plan) {
      return reply.code(404).send({ message: "Plano nao encontrado" });
    }

    const currentAt = new Date().toISOString();
    const transactionId = randomUUID();
    const amount = Number(plan.price || 0);
    const pixCopyPaste = paymentMethod === "pix" ? buildMockPixCopyPaste(planId, amount, transactionId) : null;

    try {
      const result = await providers.purchasePlan({
        providerId: request.user.sub,
        planId,
        paymentMethod,
        cardLastFour: paymentMethod === "pix" ? null : cardLastFour ?? null,
        pixCopyPaste,
        mockTransactionId: transactionId,
        currentAt,
      });

      await safeAuditAppend(extra?.audit, request.log, {
        actorUserId: request.user.sub,
        action: "provider_plan_subscribed",
        entityType: "provider_plan_payment",
        entityId: result.payment ? String(result.payment.id) : null,
        metadata: { planId, paymentMethod },
        ipHashPrefix: hashIpForAudit(clientIpFromRequest(request), auditSecret),
        userAgentSnippet: userAgentSnippet(request),
      });

      return reply.code(201).send({
        currentSubscription: buildCurrentSubscriptionPayload(result.subscription),
        payment: result.payment ? buildPlanPaymentPayload(result.payment) : null,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "PROVIDER_PLAN_NOT_FOUND") {
        return reply.code(404).send({ message: "Plano nao encontrado" });
      }

      request.log.error(error);
      return reply.code(500).send({ message: "Nao foi possivel processar a compra do plano" });
    }
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

    await safeAuditAppend(extra?.audit, request.log, {
      actorUserId: request.user.sub,
      action: "verification_document_uploaded",
      entityType: "user",
      entityId: request.user.sub,
      metadata: null,
      ipHashPrefix: hashIpForAudit(clientIpFromRequest(request), auditSecret),
      userAgentSnippet: userAgentSnippet(request),
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

    await safeAuditAppend(extra?.audit, request.log, {
      actorUserId: request.user.sub,
      action: "verification_selfie_uploaded",
      entityType: "user",
      entityId: request.user.sub,
      metadata: null,
      ipHashPrefix: hashIpForAudit(clientIpFromRequest(request), auditSecret),
      userAgentSnippet: userAgentSnippet(request),
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
    await safeAuditAppend(extra?.audit, request.log, {
      actorUserId: request.user.sub,
      action: "verification_submitted",
      entityType: "user",
      entityId: request.user.sub,
      metadata: { status: "pending" },
      ipHashPrefix: hashIpForAudit(clientIpFromRequest(request), auditSecret),
      userAgentSnippet: userAgentSnippet(request),
    });
    return reply.send({ status: "pending" as const, message: "Verificação enviada para análise." });
  });

  app.get("/admin/provider-verifications", async (request, reply) => {
    const auth = parseAdminKycAuth(request.headers as Record<string, unknown>);
    if (auth.ok === false) {
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
    if (auth.ok === false) {
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
    await safeAuditAppend(extra?.audit, request.log, {
      actorUserId: null,
      action: "verification_admin_decision",
      entityType: "user",
      entityId: paramsParsed.data.providerId,
      metadata: { status: bodyParsed.data.status },
      ipHashPrefix: hashIpForAudit(clientIpFromRequest(request), auditSecret),
      userAgentSnippet: userAgentSnippet(request),
    });
    return reply.send({
      providerId: paramsParsed.data.providerId,
      status: bodyParsed.data.status,
      message: bodyParsed.data.status === "verified" ? "Prestador aprovado com sucesso." : "Prestador reprovado com sucesso.",
    });
  });
}
