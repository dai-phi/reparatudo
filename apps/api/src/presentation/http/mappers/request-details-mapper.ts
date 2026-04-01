import type { IGeoService } from "../../../domain/ports/geo-service.js";
import type { IRequestRepository } from "../../../domain/ports/request-repository.js";
import type { RequestRecord } from "../../../domain/entities/records.js";
import { SERVICE_LABELS } from "../../../domain/value-objects/service-id.js";
import { formatCurrency } from "../../../application/utils/format.js";

export type RequestDetailsDto = {
  id: string;
  status: string;
  serviceId: string;
  serviceLabel: string;
  description: string;
  agreedValue: number;
  agreedValueLabel: string;
  clientConfirmed: boolean;
  providerConfirmed: boolean;
  provider: {
    id: string;
    name: string;
    phone: string;
    photoUrl: string | null;
    rating: number;
    distanceKm: number;
  } | null;
  client: {
    id: string;
    name: string;
  } | null;
};

export async function formatRequestDetails(
  deps: {
    requests: IRequestRepository;
    geo: IGeoService;
  },
  target: RequestRecord
): Promise<RequestDetailsDto> {
  const extras = await deps.requests.getDetailsExtras({
    clientId: target.clientId,
    providerId: target.providerId,
  });

  const { provider, client, ratingAvg } = extras;
  const distance =
    provider?.workLat != null &&
    provider?.workLng != null &&
    client?.cepLat != null &&
    client?.cepLng != null
      ? deps.geo.distanceKm(
          { lat: client.cepLat, lng: client.cepLng },
          { lat: provider.workLat, lng: provider.workLng }
        )
      : 0;

  return {
    id: target.id,
    status: target.status,
    serviceId: target.serviceId,
    serviceLabel: SERVICE_LABELS[target.serviceId] ?? target.serviceId,
    description: target.description || "",
    agreedValue: Number(target.agreedValue || 0),
    agreedValueLabel: formatCurrency(Number(target.agreedValue || 0)),
    clientConfirmed: Boolean(target.clientConfirmed),
    providerConfirmed: Boolean(target.providerConfirmed),
    provider: provider
      ? {
          id: provider.id,
          name: provider.name,
          phone: provider.phone,
          photoUrl: provider.photoUrl,
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
