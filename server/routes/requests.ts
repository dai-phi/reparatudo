import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool } from "../db.js";
import { SERVICE_IDS, SERVICE_LABELS } from "../services.js";
import { distanceKm } from "../geo.js";
import { formatCurrency, formatRelativeTime, formatTime, parseCurrencyInput } from "../utils.js";
import { broadcastToRequest, broadcastToUser } from "../wsHub.js";

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

async function getRequestById(requestId: string) {
  const result = await pool.query("SELECT * FROM requests WHERE id = $1", [requestId]);
  return result.rows[0] ?? null;
}

async function ensureParticipant(requestId: string, userId: string, role: "client" | "provider") {
  const target = await getRequestById(requestId);
  if (!target) return null;
  if (role === "client" && target.client_id !== userId) return null;
  if (role === "provider" && target.provider_id !== userId) return null;
  return target;
}

async function formatRequestDetails(target: any) {
  const providerResult = target.provider_id
    ? await pool.query("SELECT id, name, phone, photo_url, work_lat, work_lng FROM users WHERE id = $1", [target.provider_id])
    : { rows: [] };
  const clientResult = await pool.query("SELECT id, name, cep_lat, cep_lng FROM users WHERE id = $1", [target.client_id]);
  const ratingsResult = target.provider_id
    ? await pool.query("SELECT AVG(rating) as rating_avg FROM ratings WHERE provider_id = $1", [target.provider_id])
    : { rows: [] };

  const provider = providerResult.rows[0];
  const client = clientResult.rows[0];
  const distance = provider?.work_lat && provider?.work_lng && client?.cep_lat && client?.cep_lng
    ? distanceKm(
        { lat: Number(client.cep_lat), lng: Number(client.cep_lng) },
        { lat: Number(provider.work_lat), lng: Number(provider.work_lng) }
      )
    : 0;
  const ratingAvg = ratingsResult.rows[0]?.rating_avg ? Number(ratingsResult.rows[0].rating_avg) : 0;

  return {
    id: target.id,
    status: target.status,
    serviceId: target.service_id,
    serviceLabel: SERVICE_LABELS[target.service_id as keyof typeof SERVICE_LABELS] ?? target.service_id,
    description: target.description || "",
    agreedValue: Number(target.agreed_value || 0),
    agreedValueLabel: formatCurrency(Number(target.agreed_value || 0)),
    clientConfirmed: Boolean(target.client_confirmed),
    providerConfirmed: Boolean(target.provider_confirmed),
    provider: provider
      ? {
          id: provider.id,
          name: provider.name,
          phone: provider.phone,
          photoUrl: provider.photo_url ?? null,
          rating: ratingAvg,
          distanceKm: Number(distance.toFixed(1)),
        }
      : null,
    client: client
      ? {
          id: client.id,
          name: client.name,
        }
      : null,
  };
}

const EVENT_CHAT_MESSAGE = "chat.message";
const EVENT_REQUEST_UPDATED = "request.updated";
const EVENT_PROVIDER_REQUEST = "provider.request";

async function broadcastRequestUpdate(requestId: string, details?: any) {
  let payload = details;
  if (!payload) {
    const target = await getRequestById(requestId);
    if (!target) return;
    payload = await formatRequestDetails(target);
  }
  broadcastToRequest(requestId, {
    type: EVENT_REQUEST_UPDATED,
    payload,
  });
}

export async function registerRequestRoutes(app: FastifyInstance) {
  app.post("/requests", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const parsed = createRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Dados invalidos", issues: parsed.error.flatten() });
    }

    const clientResult = await pool.query("SELECT id, name FROM users WHERE id = $1", [request.user.sub]);
    if (!clientResult.rowCount) {
      return reply.code(404).send({ message: "Cliente nao encontrado" });
    }
    const clientName = clientResult.rows[0]?.name ?? "Cliente";

    if (!parsed.data.providerId) {
      return reply.code(400).send({ message: "Selecione um prestador" });
    }

    const providerResult = await pool.query(
      "SELECT id, name, radius_km, work_lat, work_lng FROM users WHERE id = $1 AND role = 'provider' AND $2 = ANY(services)",
      [parsed.data.providerId, parsed.data.serviceId]
    );
    const provider = providerResult.rows[0] ?? null;

    if (!provider) {
      return reply.code(404).send({ message: "Prestador nao encontrado" });
    }

    const clientCoordsResult = await pool.query(
      "SELECT cep_lat, cep_lng FROM users WHERE id = $1",
      [request.user.sub]
    );
    const clientCoords = clientCoordsResult.rows[0];
    if (!clientCoords?.cep_lat || !clientCoords?.cep_lng) {
      return reply.code(400).send({ message: "CEP do cliente nao cadastrado" });
    }
    if (!provider.work_lat || !provider.work_lng) {
      return reply.code(400).send({ message: "CEP do prestador nao cadastrado" });
    }
    const distance = distanceKm(
      { lat: Number(clientCoords.cep_lat), lng: Number(clientCoords.cep_lng) },
      { lat: Number(provider.work_lat), lng: Number(provider.work_lng) }
    );
    if (!provider.radius_km || distance > Number(provider.radius_km)) {
      return reply.code(400).send({ message: "Prestador fora do raio de atendimento" });
    }

    const now = new Date().toISOString();
    const requestId = randomUUID();

    await pool.query(
      `INSERT INTO requests (id, client_id, provider_id, service_id, description, status, location_lat, location_lng, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        requestId,
        request.user.sub,
        provider.id,
        parsed.data.serviceId,
        parsed.data.description?.trim() || null,
        "open",
        parsed.data.location?.lat ?? null,
        parsed.data.location?.lng ?? null,
        now,
        now,
      ]
    );

    await pool.query(
      `INSERT INTO messages (id, request_id, from_role, text, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [randomUUID(), requestId, "system", `Pedido enviado para ${provider.name}.`, now]
    );

    const serviceLabel = SERVICE_LABELS[parsed.data.serviceId as keyof typeof SERVICE_LABELS] ?? parsed.data.serviceId;
    const providerNotification = {
      id: requestId,
      client: clientName,
      service: serviceLabel,
      desc: parsed.data.description?.trim() || "Sem descricao",
      distance: `${distance.toFixed(1)} km`,
      time: formatRelativeTime(now),
      status: "open",
    };
    broadcastToUser(provider.id, {
      type: EVENT_PROVIDER_REQUEST,
      requestId,
      payload: providerNotification,
    });

    return reply.send({ requestId });
  });

  app.get("/requests/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const target = await getRequestById(request.params.id);

    if (!target) {
      return reply.code(404).send({ message: "Pedido nao encontrado" });
    }

    const isClient = request.user.role === "client" && target.client_id === request.user.sub;
    const isProvider = request.user.role === "provider" && target.provider_id === request.user.sub;

    if (!isClient && !isProvider) {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    return reply.send(await formatRequestDetails(target));
  });

  app.get("/requests/:id/messages", { preHandler: [app.authenticate] }, async (request, reply) => {
    const target = await ensureParticipant(request.params.id, request.user.sub, request.user.role);

    if (!target) {
      return reply.code(404).send({ message: "Pedido nao encontrado" });
    }

    const messagesResult = await pool.query(
      `SELECT id, from_role, text, created_at
       FROM messages
       WHERE request_id = $1
       ORDER BY created_at ASC`,
      [target.id]
    );

    const messages = messagesResult.rows.map((msg) => ({
      id: msg.id,
      from: msg.from_role,
      text: msg.text,
      time: formatTime(msg.created_at),
    }));

    return reply.send(messages);
  });

  app.post("/requests/:id/messages", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = messageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Mensagem invalida" });
    }

    const target = await ensureParticipant(request.params.id, request.user.sub, request.user.role);

    if (!target) {
      return reply.code(404).send({ message: "Pedido nao encontrado" });
    }

    const now = new Date().toISOString();
    const message = {
      id: randomUUID(),
      requestId: target.id,
      from: request.user.role,
      text: parsed.data.text.trim(),
      createdAt: now,
    };

    await pool.query(
      `INSERT INTO messages (id, request_id, from_role, text, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [message.id, message.requestId, message.from, message.text, message.createdAt]
    );

    const formattedMessage = {
      id: message.id,
      from: message.from,
      text: message.text,
      time: formatTime(message.createdAt),
    };
    broadcastToRequest(target.id, {
      type: EVENT_CHAT_MESSAGE,
      payload: formattedMessage,
    });

    return reply.send({
      id: message.id,
      from: message.from,
      text: message.text,
      time: formatTime(message.createdAt),
    });
  });

  app.post("/requests/:id/accept", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const target = await getRequestById(request.params.id);
    if (!target) {
      return reply.code(404).send({ message: "Pedido nao encontrado" });
    }

    if (target.provider_id && target.provider_id !== request.user.sub) {
      return reply.code(403).send({ message: "Pedido ja atribuido" });
    }

    const now = new Date().toISOString();

    await pool.query(
      `UPDATE requests SET provider_id = $1, status = $2, accepted_at = $3, updated_at = $3 WHERE id = $4`,
      [request.user.sub, "accepted", now, target.id]
    );

    const acceptedMessageId = randomUUID();
    const acceptedMessageText = "✅ Prestador aceitou o pedido.";
    await pool.query(
      `INSERT INTO messages (id, request_id, from_role, text, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [acceptedMessageId, target.id, "system", acceptedMessageText, now]
    );
    broadcastToRequest(target.id, {
      type: EVENT_CHAT_MESSAGE,
      payload: {
        id: acceptedMessageId,
        from: "system",
        text: acceptedMessageText,
        time: formatTime(now),
      },
    });
    await broadcastRequestUpdate(target.id);

    return reply.send({ ok: true });
  });

  app.post("/requests/:id/reject", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const target = await ensureParticipant(request.params.id, request.user.sub, "provider");

    if (!target) {
      return reply.code(404).send({ message: "Pedido nao encontrado" });
    }

    const now = new Date().toISOString();

    await pool.query(
      `UPDATE requests SET status = $1, updated_at = $2 WHERE id = $3`,
      ["rejected", now, target.id]
    );

    const rejectedMessageId = randomUUID();
    const rejectedMessageText = "❌ Prestador recusou o pedido.";
    await pool.query(
      `INSERT INTO messages (id, request_id, from_role, text, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [rejectedMessageId, target.id, "system", rejectedMessageText, now]
    );
    broadcastToRequest(target.id, {
      type: EVENT_CHAT_MESSAGE,
      payload: {
        id: rejectedMessageId,
        from: "system",
        text: rejectedMessageText,
        time: formatTime(now),
      },
    });
    await broadcastRequestUpdate(target.id);

    return reply.send({ ok: true });
  });

  app.post("/requests/:id/confirm", { preHandler: [app.authenticate] }, async (request, reply) => {
    const parsed = statusValueSchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.code(400).send({ message: "Dados invalidos" });
    }

    const target = await ensureParticipant(request.params.id, request.user.sub, request.user.role);

    if (!target) {
      return reply.code(404).send({ message: "Pedido nao encontrado" });
    }

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: Array<string | number | boolean | null> = [];
    let idx = 1;

    if (request.user.role === "client") {
      const agreedValue = parseCurrencyInput(parsed.data.agreedValue || undefined);
      updates.push(`client_confirmed = $${idx++}`);
      values.push(true);
      if (agreedValue) {
        updates.push(`agreed_value = $${idx++}`);
        values.push(agreedValue);
      }
    } else {
      updates.push(`provider_confirmed = $${idx++}`);
      values.push(true);
    }

    updates.push(`updated_at = $${idx++}`);
    values.push(now);
    values.push(target.id);

    await pool.query(`UPDATE requests SET ${updates.join(", ")} WHERE id = $${idx}`, values);

  const refreshed = await getRequestById(target.id);
  const clientConfirmed = Boolean(refreshed?.client_confirmed);
  const providerConfirmed = Boolean(refreshed?.provider_confirmed);

    let statusChanged = false;
    if (clientConfirmed && providerConfirmed && refreshed && refreshed.status !== "confirmed") {
      await pool.query(
        `UPDATE requests SET status = $1, confirmed_at = $2, updated_at = $2 WHERE id = $3`,
        ["confirmed", now, target.id]
      );
      statusChanged = true;
    }

    const latest = await getRequestById(target.id);
    if (!latest) {
      return reply.code(404).send({ message: "Pedido nao encontrado" });
    }
    const formattedRequest = await formatRequestDetails(latest);
    const agreedValueLabel = formattedRequest.agreedValueLabel || "a combinar";
    const messageText = statusChanged
      ? `✅ Servico confirmado! Valor acordado: ${agreedValueLabel}.`
      : request.user.role === "client"
        ? "✅ Cliente confirmou o servico. Aguardando prestador."
        : "✅ Prestador confirmou o servico. Aguardando cliente.";
    const messageId = randomUUID();

    await pool.query(
      `INSERT INTO messages (id, request_id, from_role, text, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [messageId, target.id, "system", messageText, now]
    );

    const messagePayload = {
      id: messageId,
      from: "system",
      text: messageText,
      time: formatTime(now),
    };
    broadcastToRequest(target.id, {
      type: EVENT_CHAT_MESSAGE,
      payload: messagePayload,
    });
    await broadcastRequestUpdate(target.id, formattedRequest);

    return reply.send({
      request: formattedRequest,
      message: messagePayload,
    });
  });

  app.post("/requests/:id/cancel", { preHandler: [app.authenticate] }, async (request, reply) => {
    const target = await ensureParticipant(request.params.id, request.user.sub, request.user.role);

    if (!target) {
      return reply.code(404).send({ message: "Pedido nao encontrado" });
    }

    const now = new Date().toISOString();

    await pool.query(
      `UPDATE requests SET status = $1, updated_at = $2 WHERE id = $3`,
      ["cancelled", now, target.id]
    );

    const messageText = `❌ Servico cancelado pelo ${request.user.role === "client" ? "cliente" : "prestador"}.`;
    const messageId = randomUUID();

    await pool.query(
      `INSERT INTO messages (id, request_id, from_role, text, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [messageId, target.id, "system", messageText, now]
    );

    const messagePayload = {
      id: messageId,
      from: "system",
      text: messageText,
      time: formatTime(now),
    };
    broadcastToRequest(target.id, {
      type: EVENT_CHAT_MESSAGE,
      payload: messagePayload,
    });
    const updated = await getRequestById(target.id);
    if (!updated) {
      return reply.code(404).send({ message: "Pedido nao encontrado" });
    }
    const formattedRequest = await formatRequestDetails(updated);
    await broadcastRequestUpdate(target.id, formattedRequest);

    return reply.send({
      request: formattedRequest,
      message: messagePayload,
    });
  });

  app.post("/requests/:id/complete", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "provider") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const target = await ensureParticipant(request.params.id, request.user.sub, "provider");

    if (!target) {
      return reply.code(404).send({ message: "Pedido nao encontrado" });
    }

    const now = new Date().toISOString();

    await pool.query(
      `UPDATE requests SET status = $1, completed_at = $2, updated_at = $2 WHERE id = $3`,
      ["completed", now, target.id]
    );

    const messageText = "🎉 Servico finalizado! Obrigado por usar o FixJa.";
    const messageId = randomUUID();

    await pool.query(
      `INSERT INTO messages (id, request_id, from_role, text, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [messageId, target.id, "system", messageText, now]
    );

    const messagePayload = {
      id: messageId,
      from: "system",
      text: messageText,
      time: formatTime(now),
    };
    broadcastToRequest(target.id, {
      type: EVENT_CHAT_MESSAGE,
      payload: messagePayload,
    });
    const updated = await getRequestById(target.id);
    if (!updated) {
      return reply.code(404).send({ message: "Pedido nao encontrado" });
    }
    const formattedRequest = await formatRequestDetails(updated);
    await broadcastRequestUpdate(target.id, formattedRequest);

    return reply.send({
      request: formattedRequest,
      message: messagePayload,
    });
  });
}
