import { randomUUID } from "node:crypto";
import type { Role } from "../../domain/entities/role.js";
import type { IUserRepository } from "../../domain/ports/user-repository.js";
import type { IRequestRepository } from "../../domain/ports/request-repository.js";
import type { IGeoService } from "../../domain/ports/geo-service.js";
import type { IRealtimeBroadcaster } from "../../domain/ports/realtime-broadcaster.js";
import type { ServiceId } from "../../domain/value-objects/service-id.js";
import { SERVICE_LABELS } from "../../domain/value-objects/service-id.js";
import { formatRelativeTime, formatTime } from "../utils/format.js";
import { apiMessages, NO_DESCRIPTION } from "../../domain/value-objects/messages.js";

export const EVENT_CHAT_MESSAGE = "chat.message";
export const EVENT_REQUEST_UPDATED = "request.updated";
export const EVENT_PROVIDER_REQUEST = "provider.request";

export type RequestWorkflowDeps = {
  users: IUserRepository;
  requests: IRequestRepository;
  geo: IGeoService;
  realtime: IRealtimeBroadcaster;
};

export type CreateRequestInput = {
  clientId: string;
  serviceId: ServiceId;
  description?: string | null;
  providerId: string;
  location: { lat: number; lng: number } | null;
};

export type Failure = { status: number; message: string };

export async function listMessagesForRequest(
  requests: IRequestRepository,
  requestId: string,
  userId: string,
  role: Role
) {
  const target = await requests.ensureParticipant(requestId, userId, role);
  if (!target) return { error: { status: 404, message: apiMessages.request.notFound } as const };
  const rows = await requests.listMessages(target.id);
  return {
    ok: rows.map((msg) => ({
      id: msg.id,
      from: msg.from_role,
      text: msg.text,
      time: formatTime(msg.created_at),
    })),
  };
}

export async function sendMessage(
  deps: RequestWorkflowDeps,
  params: { requestId: string; userId: string; role: Role; text: string }
) {
  const target = await deps.requests.ensureParticipant(params.requestId, params.userId, params.role);
  if (!target) {
    return { error: { status: 404, message: apiMessages.request.notFound } as const };
  }

  if (["completed", "cancelled", "rejected"].includes(target.status)) {
    return { error: { status: 400, message: apiMessages.chat.closed } as const };
  }

  const now = new Date().toISOString();
  const message = {
    id: randomUUID(),
    requestId: target.id,
    from: params.role,
    text: params.text.trim(),
    createdAt: now,
  };

  await deps.requests.insertMessage({
    id: message.id,
    requestId: message.requestId,
    fromRole: message.from,
    text: message.text,
    createdAt: message.createdAt,
  });

  const formattedMessage = {
    id: message.id,
    from: message.from,
    text: message.text,
    time: formatTime(message.createdAt),
  };
  deps.realtime.broadcastToRequest(target.id, {
    type: EVENT_CHAT_MESSAGE,
    payload: formattedMessage,
  });

  return { ok: formattedMessage };
}

export async function createRequest(
  deps: RequestWorkflowDeps,
  input: CreateRequestInput
): Promise<{ requestId: string } | Failure> {
  const clientName = await deps.users.getClientNameById(input.clientId);
  if (!clientName) {
    return { status: 404, message: apiMessages.user.notFound };
  }

  const provider = await deps.users.findProviderForService(input.providerId, input.serviceId);
  if (!provider) {
    return { status: 404, message: apiMessages.provider.notFound };
  }

  const clientCoords = await deps.users.getClientCoords(input.clientId);
  if (!clientCoords) {
    return { status: 400, message: apiMessages.client.cepNotRegistered };
  }
  if (!provider.workLat || !provider.workLng) {
    return { status: 400, message: apiMessages.provider.cepNotRegistered };
  }

  const distance = deps.geo.distanceKm(clientCoords, {
    lat: provider.workLat,
    lng: provider.workLng,
  });
  if (!provider.radiusKm || distance > Number(provider.radiusKm)) {
    return { status: 400, message: apiMessages.provider.outOfRadius };
  }

  const now = new Date().toISOString();
  const requestId = randomUUID();

  await deps.requests.insertRequest({
    id: requestId,
    clientId: input.clientId,
    providerId: provider.id,
    serviceId: input.serviceId,
    description: input.description?.trim() || null,
    status: "open",
    locationLat: input.location?.lat ?? null,
    locationLng: input.location?.lng ?? null,
    createdAt: now,
    updatedAt: now,
  });

  await deps.requests.insertMessage({
    id: randomUUID(),
    requestId,
    fromRole: "system",
    text: `Pedido enviado para ${provider.name}.`,
    createdAt: now,
  });

  const serviceLabel = SERVICE_LABELS[input.serviceId] ?? input.serviceId;
  deps.realtime.broadcastToUser(provider.id, {
    type: EVENT_PROVIDER_REQUEST,
    requestId,
    payload: {
      id: requestId,
      client: clientName,
      service: serviceLabel,
      desc: input.description?.trim() || NO_DESCRIPTION,
      distance: `${distance.toFixed(1)} km`,
      time: formatRelativeTime(now),
      status: "open",
    },
  });

  return { requestId };
}

export async function broadcastRequestUpdate(
  deps: RequestWorkflowDeps,
  requestId: string,
  formatDetails: (id: string) => Promise<unknown>
) {
  const payload = await formatDetails(requestId);
  deps.realtime.broadcastToRequest(requestId, {
    type: EVENT_REQUEST_UPDATED,
    payload,
  });
}

export async function acceptRequest(
  deps: RequestWorkflowDeps,
  params: { requestId: string; providerId: string },
  formatDetails: (id: string) => Promise<unknown>
): Promise<{ ok: true } | Failure> {
  const target = await deps.requests.findById(params.requestId);
  if (!target) {
    return { status: 404, message: apiMessages.request.notFound };
  }

  if (target.providerId != null && target.providerId !== params.providerId) {
    return { status: 403, message: apiMessages.request.alreadyAssigned };
  }

  const now = new Date().toISOString();
  await deps.requests.updateAccept({
    requestId: target.id,
    providerId: params.providerId,
    now,
  });

  const acceptedMessageId = randomUUID();
  const acceptedMessageText = "✅ Prestador aceitou o pedido.";
  await deps.requests.insertMessage({
    id: acceptedMessageId,
    requestId: target.id,
    fromRole: "system",
    text: acceptedMessageText,
    createdAt: now,
  });
  deps.realtime.broadcastToRequest(target.id, {
    type: EVENT_CHAT_MESSAGE,
    payload: {
      id: acceptedMessageId,
      from: "system",
      text: acceptedMessageText,
      time: formatTime(now),
    },
  });
  await broadcastRequestUpdate(deps, target.id, formatDetails);
  return { ok: true };
}

export async function rejectRequest(
  deps: RequestWorkflowDeps,
  params: { requestId: string; providerId: string },
  formatDetails: (id: string) => Promise<unknown>
): Promise<{ ok: true } | Failure> {
  const target = await deps.requests.ensureParticipant(params.requestId, params.providerId, "provider");
  if (!target) {
    return { status: 404, message: apiMessages.request.notFound };
  }

  const now = new Date().toISOString();
  await deps.requests.updateReject({ requestId: target.id, now });

  const rejectedMessageId = randomUUID();
  const rejectedMessageText = "❌ Prestador recusou o pedido.";
  await deps.requests.insertMessage({
    id: rejectedMessageId,
    requestId: target.id,
    fromRole: "system",
    text: rejectedMessageText,
    createdAt: now,
  });
  deps.realtime.broadcastToRequest(target.id, {
    type: EVENT_CHAT_MESSAGE,
    payload: {
      id: rejectedMessageId,
      from: "system",
      text: rejectedMessageText,
      time: formatTime(now),
    },
  });
  await broadcastRequestUpdate(deps, target.id, formatDetails);
  return { ok: true };
}

export async function confirmRequest(
  deps: RequestWorkflowDeps,
  params: {
    requestId: string;
    userId: string;
    role: Role;
    agreedValueStr?: string | null;
  },
  parseCurrency: (v?: string) => number,
  formatDetails: (id: string) => Promise<unknown>
): Promise<
  | {
      request: unknown;
      message: {
        id: string;
        from: string;
        text: string;
        time: string;
      };
    }
  | Failure
> {
  const agreedValue =
    params.role === "client" ? parseCurrency(params.agreedValueStr || undefined) : 0;

  const target = await deps.requests.ensureParticipant(params.requestId, params.userId, params.role);
  if (!target) {
    return { status: 404, message: apiMessages.request.notFound };
  }

  const now = new Date().toISOString();
  await deps.requests.confirmStep({
    requestId: target.id,
    role: params.role,
    agreedValue: params.role === "client" ? agreedValue : null,
    now,
  });

  const refreshed = await deps.requests.findById(target.id);
  const clientConfirmed = Boolean(refreshed?.clientConfirmed);
  const providerConfirmed = Boolean(refreshed?.providerConfirmed);

  let statusChanged = false;
  if (clientConfirmed && providerConfirmed && refreshed && refreshed.status !== "confirmed") {  
    await deps.requests.setConfirmedStatus({ requestId: target.id, now });
    statusChanged = true;
  }

  const latest = await deps.requests.findById(target.id);
  if (!latest) {
    return { status: 404, message: apiMessages.request.notFound };
  }

  const formattedRequest = (await formatDetails(latest.id)) as { agreedValueLabel?: string };
  const agreedValueLabel = formattedRequest.agreedValueLabel || "a combinar";

  const messageText = statusChanged
    ? `✅ Serviço confirmado! Valor acordado: ${agreedValueLabel}.`
    : params.role === "client"
      ? "✅ Cliente confirmou o serviço. Aguardando prestador."
      : "✅ Prestador confirmou o serviço. Aguardando cliente.";
  const messageId = randomUUID();

  await deps.requests.insertMessage({
    id: messageId,
    requestId: target.id,
    fromRole: "system",
    text: messageText,
    createdAt: now,
  });

  const messagePayload = {
    id: messageId,
    from: "system",
    text: messageText,
    time: formatTime(now),
  };
  deps.realtime.broadcastToRequest(target.id, {
    type: EVENT_CHAT_MESSAGE,
    payload: messagePayload,
  });
  await broadcastRequestUpdate(deps, target.id, async () => formattedRequest);

  return {
    request: formattedRequest,
    message: messagePayload,
  };
}

export async function cancelRequest(
  deps: RequestWorkflowDeps,
  params: { requestId: string; userId: string; role: Role; reason?: string | null },
  formatDetails: (id: string) => Promise<unknown>
): Promise<
  | {
      request: unknown;
      message: {
        id: string;
        from: string;
        text: string;
        time: string;
      };
    }
  | Failure
> {
  const target = await deps.requests.ensureParticipant(params.requestId, params.userId, params.role);
  if (!target) {
    return { status: 404, message: apiMessages.request.notFound };
  }

  const now = new Date().toISOString();
  const reasonText = params.reason?.trim() || null;
  await deps.requests.updateCancel({ requestId: target.id, now, reason: reasonText });

  const messageText = reasonText
    ? `❌ Serviço cancelado pelo ${params.role === "client" ? "cliente" : "prestador"}. Motivo: ${reasonText}`
    : `❌ Serviço cancelado pelo ${params.role === "client" ? "cliente" : "prestador"}.`;
  const messageId = randomUUID();

  await deps.requests.insertMessage({
    id: messageId,
    requestId: target.id,
    fromRole: "system",
    text: messageText,
    createdAt: now,
  });

  const messagePayload = {
    id: messageId,
    from: "system",
    text: messageText,
    time: formatTime(now),
  };
  deps.realtime.broadcastToRequest(target.id, {
    type: EVENT_CHAT_MESSAGE,
    payload: messagePayload,
  });

  const updated = await deps.requests.findById(target.id);
  if (!updated) {
    return { status: 404, message: apiMessages.request.notFound };
  }
  const formattedRequest = await formatDetails(updated.id);
  await broadcastRequestUpdate(deps, target.id, async () => formattedRequest);

  return {
    request: formattedRequest,
    message: messagePayload,
  };
}

export async function completeRequest(
  deps: RequestWorkflowDeps,
  params: { requestId: string; providerId: string },
  formatDetails: (id: string) => Promise<unknown>
): Promise<
  | {
      request: unknown;
      message: {
        id: string;
        from: string;
        text: string;
        time: string;
      };
    }
  | Failure
> {
  const target = await deps.requests.ensureParticipant(params.requestId, params.providerId, "provider");
  if (!target) {
    return { status: 404, message: apiMessages.request.notFound };
  }

  const now = new Date().toISOString();
  await deps.requests.updateComplete({ requestId: target.id, now });

  const clientCoords = await deps.users.getClientCoords(target.clientId);
  if (clientCoords) {
    await deps.requests.updateProviderLastService({
      providerId: params.providerId,
      lat: clientCoords.lat,
      lng: clientCoords.lng,
      now,
    });
  }

  const messageText = "🎉 Serviço finalizado! Obrigado por usar o Repara Tudo!";
  const messageId = randomUUID();

  await deps.requests.insertMessage({
    id: messageId,
    requestId: target.id,
    fromRole: "system",
    text: messageText,
    createdAt: now,
  });

  const messagePayload = {
    id: messageId,
    from: "system",
    text: messageText,
    time: formatTime(now),
  };
  deps.realtime.broadcastToRequest(target.id, {
    type: EVENT_CHAT_MESSAGE,
    payload: messagePayload,
  });

  const updated = await deps.requests.findById(target.id);
  if (!updated) {
    return { status: 404, message: apiMessages.request.notFound };
  }
  const formattedRequest = await formatDetails(updated.id);
  await broadcastRequestUpdate(deps, target.id, async () => formattedRequest);

  return {
    request: formattedRequest,
    message: messagePayload,
  };
}
