import { randomUUID } from "node:crypto";
import type { IUserRepository } from "../../domain/ports/repositories/user-repository.js";
import type { IOpenJobRepository } from "../../domain/ports/repositories/open-job-repository.js";
import type { IRequestRepository } from "../../domain/ports/repositories/request-repository.js";
import type { IGeoService } from "../../domain/ports/geo-service.js";
import type { IRealtimeBroadcaster } from "../../domain/ports/realtime-broadcaster.js";
import type { ServiceId } from "../../domain/value-objects/service-id.js";
import { SERVICE_LABELS } from "../../domain/value-objects/service-id.js";
import { getServiceSubtypeLabelPt } from "../../domain/value-objects/service-subtype-catalog.js";
import { apiMessages, NO_DESCRIPTION } from "../../domain/value-objects/messages.js";
import { MAX_ACTIVE_DEMAND_PER_SERVICE_TYPE } from "../../domain/value-objects/client-service-limits.js";
import { countActiveDemandForClientService } from "../clients/client-service-demand.js";
import { formatRelativeTime } from "../utils/format.js";
import { EVENT_PROVIDER_REQUEST } from "../requests/request-workflow.js";

export const EVENT_OPEN_JOB_UPDATED = "open_job.updated";

export type OpenJobWorkflowDeps = {
  users: IUserRepository;
  openJobs: IOpenJobRepository;
  requests: IRequestRepository;
  geo: IGeoService;
  realtime: IRealtimeBroadcaster;
};

export type Failure = { status: number; message: string };

export async function createOpenJob(
  deps: OpenJobWorkflowDeps,
  input: {
    clientId: string;
    serviceId: ServiceId;
    serviceSubtype: string;
    description?: string | null;
    location: { lat: number; lng: number } | null;
  }
): Promise<{ openJobId: string } | Failure> {
  const clientName = await deps.users.getClientNameById(input.clientId);
  if (!clientName) {
    return { status: 404, message: apiMessages.user.notFound };
  }

  const clientCoords = await deps.users.getClientCoords(input.clientId);
  if (!clientCoords) {
    return { status: 400, message: apiMessages.client.cepNotRegistered };
  }

  const activeDemand = await countActiveDemandForClientService(
    deps.requests,
    deps.openJobs,
    input.clientId,
    input.serviceId
  );
  if (activeDemand >= MAX_ACTIVE_DEMAND_PER_SERVICE_TYPE) {
    return { status: 400, message: apiMessages.client.maxActiveDemandPerService };
  }

  const now = new Date().toISOString();
  const id = randomUUID();

  await deps.openJobs.insertOpenJob({
    id,
    clientId: input.clientId,
    serviceId: input.serviceId,
    serviceSubtype: input.serviceSubtype,
    description: input.description?.trim() || null,
    status: "open",
    locationLat: input.location?.lat ?? null,
    locationLng: input.location?.lng ?? null,
    createdAt: now,
    updatedAt: now,
  });

  deps.realtime.broadcastToUser(input.clientId, {
    type: EVENT_OPEN_JOB_UPDATED,
    payload: { openJobId: id, action: "created" },
  });

  return { openJobId: id };
}

function withinProviderRadius(
  deps: OpenJobWorkflowDeps,
  clientCoords: { lat: number; lng: number },
  provider: { workLat: number | null; workLng: number | null; radiusKm: number | null }
): boolean {
  if (!provider.workLat || !provider.workLng) return false;
  if (!provider.radiusKm) return false;
  const distance = deps.geo.distanceKm(clientCoords, { lat: provider.workLat, lng: provider.workLng });
  return distance <= Number(provider.radiusKm);
}

export async function listDiscoverableOpenJobs(
  deps: OpenJobWorkflowDeps,
  providerId: string
): Promise<
  | Array<{
      id: string;
      serviceId: ServiceId;
      serviceLabel: string;
      serviceSubtype: string | null;
      serviceSubtypeLabel: string | null;
      description: string;
      clientName: string;
      distanceKm: number;
      createdAt: string;
      timeLabel: string;
    }>
  | Failure
> {
  const provider = await deps.users.findById(providerId);
  if (!provider || provider.role !== "provider") {
    return { status: 403, message: "Acesso negado" };
  }

  const rows = await deps.openJobs.listDiscoverableForProvider(providerId);
  const out: Array<{
    id: string;
    serviceId: ServiceId;
    serviceLabel: string;
    serviceSubtype: string | null;
    serviceSubtypeLabel: string | null;
    description: string;
    clientName: string;
    distanceKm: number;
    createdAt: string;
    timeLabel: string;
  }> = [];

  for (const row of rows) {
    const clientCoords = { lat: row.clientLat, lng: row.clientLng };
    const p = await deps.users.findProviderForService(providerId, row.serviceId);
    if (!p) continue;
    if (!withinProviderRadius(deps, clientCoords, p)) continue;

    const distance = deps.geo.distanceKm(clientCoords, {
      lat: p.workLat!,
      lng: p.workLng!,
    });

    out.push({
      id: row.id,
      serviceId: row.serviceId,
      serviceLabel: SERVICE_LABELS[row.serviceId] ?? row.serviceId,
      serviceSubtype: row.serviceSubtype,
      serviceSubtypeLabel: getServiceSubtypeLabelPt(row.serviceId, row.serviceSubtype),
      description: row.description?.trim() || NO_DESCRIPTION,
      clientName: row.clientName,
      distanceKm: Number(distance.toFixed(1)),
      createdAt: row.createdAt,
      timeLabel: formatRelativeTime(row.createdAt),
    });
  }

  return out;
}

export async function submitQuote(
  deps: OpenJobWorkflowDeps,
  input: {
    providerId: string;
    openJobId: string;
    amount: number;
    etaDays?: number | null;
    message?: string | null;
    conditions?: string | null;
  }
): Promise<{ quoteId: string } | Failure> {
  const job = await deps.openJobs.findById(input.openJobId);
  if (!job) {
    return { status: 404, message: apiMessages.openJob.notFound };
  }
  if (job.status !== "open") {
    return { status: 400, message: apiMessages.openJob.notOpen };
  }

  const provider = await deps.users.findProviderForService(input.providerId, job.serviceId);
  if (!provider) {
    return { status: 404, message: apiMessages.provider.notFound };
  }

  const clientCoords = await deps.users.getClientCoords(job.clientId);
  if (!clientCoords) {
    return { status: 400, message: apiMessages.client.cepNotRegistered };
  }

  if (!withinProviderRadius(deps, clientCoords, provider)) {
    return { status: 400, message: apiMessages.openJob.providerOutOfRadius };
  }

  const dup = await deps.openJobs.hasQuoteFromProvider(job.id, input.providerId);
  if (dup) {
    return { status: 409, message: apiMessages.openJob.duplicateQuote };
  }

  const now = new Date().toISOString();
  const quoteId = randomUUID();

  await deps.openJobs.insertQuote({
    id: quoteId,
    openJobId: job.id,
    providerId: input.providerId,
    amount: input.amount,
    etaDays: input.etaDays ?? null,
    message: input.message?.trim() || null,
    conditions: input.conditions?.trim() || null,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  deps.realtime.broadcastToUser(job.clientId, {
    type: EVENT_OPEN_JOB_UPDATED,
    payload: { openJobId: job.id, action: "new_quote", quoteId },
  });

  return { quoteId };
}

export async function acceptQuote(
  deps: OpenJobWorkflowDeps,
  input: { clientId: string; openJobId: string; quoteId: string }
): Promise<{ requestId: string } | Failure> {
  const job = await deps.openJobs.findById(input.openJobId);
  if (!job) {
    return { status: 404, message: apiMessages.openJob.notFound };
  }
  if (job.clientId !== input.clientId) {
    return { status: 403, message: apiMessages.openJob.notOwner };
  }
  if (job.status !== "open") {
    return { status: 400, message: apiMessages.openJob.notOpen };
  }

  const quote = await deps.openJobs.findQuoteById(input.quoteId);
  if (!quote || quote.openJobId !== job.id || quote.status !== "pending") {
    return { status: 400, message: apiMessages.openJob.invalidQuote };
  }

  const provider = await deps.users.findProviderForService(quote.providerId, job.serviceId);
  if (!provider) {
    return { status: 400, message: apiMessages.provider.notFound };
  }

  const clientCoords = await deps.users.getClientCoords(job.clientId);
  if (!clientCoords) {
    return { status: 400, message: apiMessages.client.cepNotRegistered };
  }

  if (!withinProviderRadius(deps, clientCoords, provider)) {
    return { status: 400, message: apiMessages.openJob.providerOutOfRadius };
  }

  const requestId = randomUUID();
  const now = new Date().toISOString();
  const clientName = (await deps.users.getClientNameById(job.clientId)) ?? "Cliente";
  const serviceLabel = SERVICE_LABELS[job.serviceId] ?? job.serviceId;
  const systemMessageText = `Pedido criado a partir do chamado aberto. Valor proposto: R$ ${quote.amount.toFixed(2).replace(".", ",")}.`;

  await deps.openJobs.acceptQuoteAndCreateRequest({
    quoteId: quote.id,
    openJobId: job.id,
    requestId,
    clientId: job.clientId,
    providerId: quote.providerId,
    serviceId: job.serviceId,
    serviceSubtype: job.serviceSubtype,
    description: job.description,
    agreedValue: quote.amount,
    locationLat: job.locationLat,
    locationLng: job.locationLng,
    now,
    systemMessageId: randomUUID(),
    systemMessageText,
  });

  const distance = deps.geo.distanceKm(clientCoords, {
    lat: provider.workLat!,
    lng: provider.workLng!,
  });

  deps.realtime.broadcastToUser(quote.providerId, {
    type: EVENT_PROVIDER_REQUEST,
    requestId,
    payload: {
      id: requestId,
      client: clientName,
      service: serviceLabel,
      desc: job.description?.trim() || NO_DESCRIPTION,
      distance: `${distance.toFixed(1)} km`,
      time: formatRelativeTime(now),
      status: "accepted",
    },
  });

  deps.realtime.broadcastToUser(job.clientId, {
    type: EVENT_OPEN_JOB_UPDATED,
    payload: { openJobId: job.id, action: "awarded", requestId },
  });

  return { requestId };
}

export async function cancelOpenJob(
  deps: OpenJobWorkflowDeps,
  input: { clientId: string; openJobId: string }
): Promise<{ ok: true } | Failure> {
  const job = await deps.openJobs.findById(input.openJobId);
  if (!job) {
    return { status: 404, message: apiMessages.openJob.notFound };
  }
  if (job.clientId !== input.clientId) {
    return { status: 403, message: apiMessages.openJob.notOwner };
  }
  if (job.status !== "open") {
    return { status: 400, message: apiMessages.openJob.notOpen };
  }

  const now = new Date().toISOString();
  await deps.openJobs.rejectAllPendingForOpenJob(job.id, now);

  await deps.openJobs.updateJobStatus({ id: job.id, status: "cancelled", updatedAt: now });

  deps.realtime.broadcastToUser(job.clientId, {
    type: EVENT_OPEN_JOB_UPDATED,
    payload: { openJobId: job.id, action: "cancelled" },
  });

  return { ok: true };
}
