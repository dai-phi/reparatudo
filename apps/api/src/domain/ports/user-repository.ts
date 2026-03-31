import type { Role } from "../entities/role.js";
import type { UserRecord } from "../entities/records.js";
import type { ServiceId } from "../value-objects/service-id.js";

export type RegisterClientInput = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string;
  cep: string;
  cepLat: number;
  cepLng: number;
  address: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export type RegisterProviderInput = {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf: string | null;
  radiusKm: number;
  services: ServiceId[];
  workCep: string;
  workLat: number;
  workLng: number;
  workAddress: string;
  passwordHash: string;
  photoUrl?: string | null;
  photoStorageKey?: string | null;
  verificationDocumentUrl?: string | null;
  verificationDocumentStorageKey?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderForRequest = {
  id: string;
  name: string;
  radiusKm: number | null;
  workLat: number | null;
  workLng: number | null;
};

export interface IUserRepository {
  existsByEmailLower(email: string): Promise<boolean>;
  /** True if another user already has this phone (digits compared after stripping non-digits). */
  existsByPhoneDigits(phoneDigits: string, excludeUserId?: string): Promise<boolean>;
  /** True if another user already has this CPF (digits compared after stripping non-digits). */
  existsByCpfDigits(cpfDigits: string, excludeUserId?: string): Promise<boolean>;
  insertClient(input: RegisterClientInput): Promise<void>;
  insertProvider(input: RegisterProviderInput): Promise<void>;
  findByEmailLower(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  getClientNameById(id: string): Promise<string | null>;
  getClientCoords(id: string): Promise<{ lat: number; lng: number } | null>;
  findProviderForService(providerId: string, serviceId: ServiceId): Promise<ProviderForRequest | null>;
}
