import type { IRequestRepository } from "../../domain/ports/repositories/request-repository.js";
import type { IOpenJobRepository } from "../../domain/ports/repositories/open-job-repository.js";
import type { ServiceId } from "../../domain/value-objects/service-id.js";

export async function countActiveDemandForClientService(
  requests: IRequestRepository,
  openJobs: IOpenJobRepository,
  clientId: string,
  serviceId: ServiceId
): Promise<number> {
  const [fromRequests, fromOpenJobs] = await Promise.all([
    requests.countActiveByClientAndService(clientId, serviceId),
    openJobs.countOpenByClientAndService(clientId, serviceId),
  ]);
  return fromRequests + fromOpenJobs;
}
