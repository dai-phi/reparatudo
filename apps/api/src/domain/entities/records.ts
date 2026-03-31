import type { Role } from "./role.js";
import type { ServiceId } from "../value-objects/service-id.js";

export interface UserRecord {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone: string;
  cep: string | null;
  cepLat: number | null;
  cepLng: number | null;
  workCep: string | null;
  workLat: number | null;
  workLng: number | null;
  workAddress: string | null;
  photoUrl: string | null;
  verificationDocumentUrl?: string | null;
  address: string | null;
  cpf: string | null;
  radiusKm: number | null;
  services: ServiceId[] | null;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestRecord {
  id: string;
  clientId: string;
  providerId: string | null;
  serviceId: ServiceId;
  description: string | null;
  status: string;
  agreedValue: number | null;
  clientConfirmed: boolean | null;
  providerConfirmed: boolean | null;
  acceptedAt: string | null;
  confirmedAt: string | null;
  cancellationReason: string | null;
  locationLat: number | null;
  locationLng: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface MessageRecord {
  id: string;
  requestId: string;
  from: "client" | "provider" | "system";
  text: string;
  createdAt: string;
}

export interface RatingRecord {
  id: string;
  requestId: string;
  clientId: string;
  providerId: string;
  rating: number;
  review: string | null;
  createdAt: string;
}
