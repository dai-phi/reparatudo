import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SERVICE_IDS } from "../../../domain/value-objects/service-id.js";
import { SERVICE_LABELS } from "../../../domain/value-objects/service-id.js";
import { formatCurrency } from "../../utils/format.js";
import type { IUserRepository } from "../../../domain/ports/user-repository.js";
import type { IOpenJobRepository } from "../../../domain/ports/open-job-repository.js";
import type { IGeoService } from "../../../domain/ports/geo-service.js";
import type { IRealtimeBroadcaster } from "../../../domain/ports/realtime-broadcaster.js";
import {
  acceptQuote,
  cancelOpenJob,
  createOpenJob,
  listDiscoverableOpenJobs,
  submitQuote,
  type OpenJobWorkflowDeps,
} from "../../../application/open-jobs/open-job-workflow.js";

const createOpenJobSchema = z.object({
  serviceId: z.enum(SERVICE_IDS),
  description: z.string().optional().nullable(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});

const quoteSchema = z.object({
  amount: z.number().positive().max(1_000_000),
  etaDays: z.number().int().min(0).max(365).optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
  conditions: z.string().trim().max(2000).optional().nullable(),
});

export type OpenJobRouteDeps = {
  users: IUserRepository;
  openJobs: IOpenJobRepository;
  geo: IGeoService;
  realtime: IRealtimeBroadcaster;
};

async function providerCanViewOpenJob(
  deps: OpenJobWorkflowDeps,
  providerId: string,
  jobId: string
): Promise<boolean> {
  const job = await deps.openJobs.findById(jobId);
  if (!job) return false;
  if (await deps.openJobs.hasQuoteFromProvider(jobId, providerId)) return true;
  const discover = await listDiscoverableOpenJobs(deps, providerId);
  if ("status" in discover) return false;
  return discover.some((j) => j.id === jobId);
}

export async function registerOpenJobRoutes(app: FastifyInstance, deps: OpenJobRouteDeps) {
  const workflowDeps: OpenJobWorkflowDeps = {
    users: deps.users,
    openJobs: deps.openJobs,
    geo: deps.geo,
    realtime: deps.realtime,
  };

  app.post("/open-jobs", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const parsed = createOpenJobSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Dados invalidos", issues: parsed.error.flatten() });
    }

    const loc = parsed.data.location;
    const location =
      loc && typeof loc.lat === "number" && typeof loc.lng === "number"
        ? { lat: loc.lat, lng: loc.lng }
        : null;

    const result = await createOpenJob(workflowDeps, {
      clientId: request.user.sub,
      serviceId: parsed.data.serviceId,
      description: parsed.data.description,
      location,
    });

    if ("status" in result) {
      return reply.code(result.status).send({ message: result.message });
    }

    return reply.send({ openJobId: result.openJobId });
  });

  app.get("/client/open-jobs", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const rows = await deps.openJobs.listForClient(request.user.sub);
    const items = await Promise.all(
      rows.map(async (job) => {
        const quotes = await deps.openJobs.listQuotesWithProviders(job.id);
        return {
          id: job.id,
          serviceId: job.serviceId,
          serviceLabel: SERVICE_LABELS[job.serviceId] ?? job.serviceId,
          description: job.description ?? "",
          status: job.status,
          quoteCount: quotes.filter((q) => q.status === "pending").length,
          createdAt: job.createdAt,
        };
      })
    );

    return reply.send({ items });
  });

  app.get("/provider/open-jobs", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const result = await listDiscoverableOpenJobs(workflowDeps, request.user.sub);
    if ("status" in result) {
      return reply.code(result.status).send({ message: result.message });
    }

    return reply.send({ items: result });
  });

  app.get("/open-jobs/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const id = (request.params as { id: string }).id;
    const job = await deps.openJobs.findById(id);
    if (!job) {
      return reply.code(404).send({ message: "Chamado nao encontrado" });
    }

    const uid = request.user.sub;
    const role = request.user.role;

    if (role === "client" && job.clientId !== uid) {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    if (role === "provider") {
      const ok = await providerCanViewOpenJob(workflowDeps, uid, id);
      if (!ok) {
        return reply.code(403).send({ message: "Acesso negado" });
      }
    }

    if (role !== "client" && role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const quotes = await deps.openJobs.listQuotesWithProviders(job.id);
    const resultRequestId =
      job.status === "awarded" ? await deps.openJobs.findRequestIdByOpenJobId(job.id) : null;

    const quotePayload =
      role === "client"
        ? quotes.map((q) => ({
            id: q.id,
            providerId: q.providerId,
            providerName: q.providerName,
            providerPhotoUrl: q.providerPhotoUrl,
            providerVerified: q.providerVerified,
            amount: q.amount,
            amountLabel: formatCurrency(q.amount),
            etaDays: q.etaDays,
            message: q.message,
            conditions: q.conditions,
            status: q.status,
            createdAt: q.createdAt,
          }))
        : quotes
            .filter((q) => q.providerId === uid)
            .map((q) => ({
              id: q.id,
              amount: q.amount,
              amountLabel: formatCurrency(q.amount),
              etaDays: q.etaDays,
              message: q.message,
              conditions: q.conditions,
              status: q.status,
              createdAt: q.createdAt,
            }));

    return reply.send({
      id: job.id,
      serviceId: job.serviceId,
      serviceLabel: SERVICE_LABELS[job.serviceId] ?? job.serviceId,
      description: job.description ?? "",
      status: job.status,
      locationLat: job.locationLat,
      locationLng: job.locationLng,
      createdAt: job.createdAt,
      resultRequestId,
      quotes: quotePayload,
    });
  });

  app.post("/open-jobs/:id/cancel", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const id = (request.params as { id: string }).id;
    const result = await cancelOpenJob(workflowDeps, { clientId: request.user.sub, openJobId: id });

    if ("status" in result) {
      return reply.code(result.status).send({ message: result.message });
    }

    return reply.send({ ok: true });
  });

  app.post("/open-jobs/:id/quotes", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const id = (request.params as { id: string }).id;
    const parsed = quoteSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Dados invalidos", issues: parsed.error.flatten() });
    }

    const result = await submitQuote(workflowDeps, {
      providerId: request.user.sub,
      openJobId: id,
      amount: parsed.data.amount,
      etaDays: parsed.data.etaDays,
      message: parsed.data.message,
      conditions: parsed.data.conditions,
    });

    if ("status" in result) {
      return reply.code(result.status).send({ message: result.message });
    }

    return reply.send({ quoteId: result.quoteId });
  });

  app.post("/open-jobs/:id/quotes/:quoteId/accept", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const { id, quoteId } = request.params as { id: string; quoteId: string };

    const result = await acceptQuote(workflowDeps, {
      clientId: request.user.sub,
      openJobId: id,
      quoteId,
    });

    if ("status" in result) {
      return reply.code(result.status).send({ message: result.message });
    }

    return reply.send({ requestId: result.requestId });
  });
}
