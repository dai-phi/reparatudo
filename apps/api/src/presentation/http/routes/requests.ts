import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { SERVICE_IDS } from "../../../domain/value-objects/service-id.js";
import type { IUserRepository } from "../../../domain/ports/user-repository.js";
import type { IRequestRepository } from "../../../domain/ports/request-repository.js";
import type { IGeoService } from "../../../domain/ports/geo-service.js";
import type { IRealtimeBroadcaster } from "../../../domain/ports/realtime-broadcaster.js";
import type { IEmailSender } from "../../../domain/ports/email-sender.js";
import { formatRequestDetails } from "../mappers/request-details-mapper.js";
import { parseCurrencyInput } from "../../utils/format.js";
import {
  acceptRequest,
  broadcastRequestUpdate,
  cancelRequest,
  completeRequest,
  confirmRequest,
  createRequest,
  listMessagesForRequest,
  rejectRequest,
  sendMessage,
  type RequestWorkflowDeps,
} from "../../../application/requests/request-workflow.js";

const createRequestSchema = z.object({
  serviceId: z.enum(SERVICE_IDS),
  description: z.string().optional().nullable(),
  providerId: z.string().optional().nullable(),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
});

const messageSchema = z.object({
  text: z.string().min(1),
});

const statusValueSchema = z.object({
  agreedValue: z.string().optional().nullable(),
});

const cancelSchema = z.object({
  reason: z.string().trim().max(280).optional().nullable(),
});

const reportIncidentSchema = z.object({
  type: z.enum(["fraude", "conduta", "cobranca", "seguranca", "outro"]),
  description: z.string().trim().min(10).max(2000),
  attachments: z.array(z.string().url()).max(5).optional(),
});

export type RequestRouteDeps = {
  users: IUserRepository;
  requests: IRequestRepository;
  geo: IGeoService;
  realtime: IRealtimeBroadcaster;
  email: IEmailSender;
};

type RequestParams = { id: string };

export async function registerRequestRoutes(app: FastifyInstance, deps: RequestRouteDeps) {
  const workflowDeps: RequestWorkflowDeps = {
    users: deps.users,
    requests: deps.requests,
    geo: deps.geo,
    realtime: deps.realtime,
    email: deps.email,
  };

  const details = async (requestId: string) => {
    const row = await deps.requests.findById(requestId);
    if (!row) throw new Error("missing request");
    return formatRequestDetails({ requests: deps.requests, geo: deps.geo }, row);
  };

  app.post("/requests", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const parsed = createRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Dados invalidos", issues: parsed.error.flatten() });
    }

    if (!parsed.data.providerId) {
      return reply.code(400).send({ message: "Selecione um prestador" });
    }

    const loc = parsed.data.location;
    const location =
      loc && typeof loc.lat === "number" && typeof loc.lng === "number"
        ? { lat: loc.lat, lng: loc.lng }
        : null;

    const result = await createRequest(workflowDeps, {
      clientId: request.user.sub,
      serviceId: parsed.data.serviceId,
      description: parsed.data.description,
      providerId: parsed.data.providerId,
      location,
    });

    if ("status" in result) {
      return reply.code(result.status).send({ message: result.message });
    }

    return reply.send({ requestId: result.requestId });
  });

  app.get("/requests/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const target = await deps.requests.findById((request.params as RequestParams).id);

    if (!target) {
      return reply.code(404).send({ message: "Pedido nao encontrado" });
    }

    const isClient = request.user.role === "client" && target.clientId === request.user.sub;
    const isProvider = request.user.role === "provider" && target.providerId === request.user.sub;

    if (!isClient && !isProvider) {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    return reply.send(await details(target.id));
  });

  app.get("/requests/:id/messages", { preHandler: [app.authenticate] }, async (request, reply) => {
    const result = await listMessagesForRequest(
      deps.requests,
      (request.params as RequestParams).id,
      request.user.sub,
      request.user.role
    );
    if ("error" in result) {
      return reply.code(result.error.status).send({ message: result.error.message });
    }
    return reply.send(result.ok);
  });

  app.post("/requests/:id/messages", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = messageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Mensagem invalida" });
    }

    const result = await sendMessage(workflowDeps, {
      requestId: (request.params as RequestParams).id,
      userId: request.user.sub,
      role: request.user.role,
      text: parsed.data.text,
    });

    if ("error" in result) {
      return reply.code(result.error.status).send({ message: result.error.message });
    }
    return reply.send(result.ok);
  });

  app.post("/requests/:id/accept", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const result = await acceptRequest(workflowDeps, { requestId: (request.params as RequestParams).id, providerId: request.user.sub }, async (id) =>
      details(id)
    );

    if ("status" in result) {
      return reply.code(result.status).send({ message: result.message });
    }
    return reply.send({ ok: true });
  });

  app.post("/requests/:id/reject", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const result = await rejectRequest(workflowDeps, { requestId: (request.params as RequestParams).id, providerId: request.user.sub }, async (id) =>
      details(id)
    );

    if ("status" in result) {
      return reply.code(result.status).send({ message: result.message });
    }
    return reply.send({ ok: true });
  });

  app.post("/requests/:id/confirm", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = statusValueSchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.code(400).send({ message: "Dados invalidos" });
    }

    const result = await confirmRequest(
      workflowDeps,
      {
        requestId: (request.params as RequestParams).id,
        userId: request.user.sub,
        role: request.user.role,
        agreedValueStr: parsed.data.agreedValue,
      },
      parseCurrencyInput,
      async (id) => details(id)
    );

    if ("status" in result) {
      return reply.code(result.status).send({ message: result.message });
    }
    return reply.send(result);
  });

  app.post("/requests/:id/cancel", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = cancelSchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.code(400).send({ message: "Dados invalidos" });
    }

    const result = await cancelRequest(
      workflowDeps,
      {
        requestId: (request.params as RequestParams).id,
        userId: request.user.sub,
        role: request.user.role,
        reason: parsed.data.reason,
      },
      async (id) => details(id)
    );

    if ("status" in result) {
      return reply.code(result.status).send({ message: result.message });
    }
    return reply.send(result);
  });

  app.post("/requests/:id/complete", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const result = await completeRequest(
      workflowDeps,
      { requestId: (request.params as RequestParams).id, providerId: request.user.sub },
      async (id) => details(id)
    );

    if ("status" in result) {
      return reply.code(result.status).send({ message: result.message });
    }
    return reply.send(result);
  });

  app.post("/requests/:id/incidents", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client" && request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const parsed = reportIncidentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Dados invalidos", issues: parsed.error.flatten() });
    }

    const target = await deps.requests.ensureParticipant((request.params as RequestParams).id, request.user.sub, request.user.role);
    if (!target) {
      return reply.code(404).send({ message: "Pedido nao encontrado" });
    }

    const targetUserId = request.user.role === "client" ? target.providerId : target.clientId;
    const now = new Date().toISOString();

    await deps.requests.insertIncident({
      id: randomUUID(),
      requestId: target.id,
      reporterId: request.user.sub,
      reporterRole: request.user.role,
      targetUserId,
      type: parsed.data.type,
      description: parsed.data.description,
      attachments: parsed.data.attachments ?? [],
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    return reply.code(201).send({ ok: true, message: "Incidente reportado com sucesso." });
  });
}
