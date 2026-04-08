import { Role } from "../../entities/role.js";
import { RequestRecord } from "../../entities/records.js";
import { ServiceId } from "../../value-objects/service-id.js";

export type MessageRow = {
  id: string;
  from_role: string;
  text: string;
  created_at: string;
};

export type RequestParticipants = {
  clientId: string;
  providerId: string | null;
};

export type ProviderPreview = {
  id: string;
  name: string;
  phone: string;
  photoUrl: string | null;
  workLat: number | null;
  workLng: number | null;
};

export type ClientPreview = {
  id: string;
  name: string;
  cepLat: number | null;
  cepLng: number | null;
};

export interface IRequestRepository {
  findById(id: string): Promise<RequestRecord | null>;
  findRequestParticipants(requestId: string): Promise<RequestParticipants | null>;
  ensureParticipant(requestId: string, userId: string, role: Role): Promise<RequestRecord | null>;
  insertRequest(params: {
    id: string;
    clientId: string;
    providerId: string;
    serviceId: ServiceId;
    serviceSubtype: string | null;
    description: string | null;
    status: string;
    locationLat: number | null;
    locationLng: number | null;
    openJobId?: string | null;
    agreedValue?: number | null;
    acceptedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<void>;
  insertMessage(params: {
    id: string;
    requestId: string;
    fromRole: "client" | "provider" | "system";
    text: string;
    createdAt: string;
  }): Promise<void>;
  listMessages(requestId: string): Promise<MessageRow[]>;
  updateAccept(params: { requestId: string; providerId: string; now: string }): Promise<void>;
  updateReject(params: { requestId: string; now: string }): Promise<void>;
  updateCancel(params: { requestId: string; now: string; reason: string | null }): Promise<void>;
  updateComplete(params: { requestId: string; now: string }): Promise<void>;
  confirmStep(params: {
    requestId: string;
    role: Role;
    agreedValue: number | null;
    now: string;
  }): Promise<void>;
  setConfirmedStatus(params: { requestId: string; now: string }): Promise<void>;
  getDetailsExtras(params: {
    clientId: string;
    providerId: string | null;
  }): Promise<{
    provider: ProviderPreview | null;
    client: ClientPreview | null;
    ratingAvg: number;
  }>;
  updateProviderLastService(params: {
    providerId: string;
    lat: number;
    lng: number;
    now: string;
  }): Promise<void>;
  insertIncident(params: {
    id: string;
    requestId: string;
    reporterId: string;
    reporterRole: "client" | "provider";
    targetUserId: string | null;
    type: string;
    description: string;
    attachments: string[];
    status: "open" | "in_review" | "resolved" | "rejected";
    createdAt: string;
    updatedAt: string;
  }): Promise<void>;

  /** Counts requests in open / accepted / confirmed for this client and service. */
  countActiveByClientAndService(clientId: string, serviceId: ServiceId): Promise<number>;
}
