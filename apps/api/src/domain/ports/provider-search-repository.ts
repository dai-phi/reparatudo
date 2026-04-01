import type { ServiceId } from "../value-objects/service-id.js";

export interface IProviderSearchRepository {
  findClientCoords(clientId: string): Promise<Record<string, unknown> | null>;
  listProvidersByService(serviceId: ServiceId): Promise<Record<string, unknown>[]>;
}
