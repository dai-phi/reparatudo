import { sanitizeUser } from "../auth/sanitize-user.js";
import type { IProviderRepository } from "../../domain/ports/repositories/provider-repository.js";
import { formatDate } from "../utils/format.js";

export type CurrentPlanSummary = {
  id: string;
  code: string;
  name: string;
  status: string;
  expiresAt: string;
  expiresAtLabel: string;
};

async function loadCurrentPlanSummary(
  providers: IProviderRepository,
  userId: string,
  role: string
): Promise<CurrentPlanSummary | null> {
  if (role !== "provider") {
    return null;
  }

  const currentAt = new Date().toISOString();
  await providers.refreshExpiredPlanSubscriptions(userId, currentAt);

  const currentPlan = await providers.findCurrentPlanSubscription(userId);
  if (!currentPlan) {
    return null;
  }

  const expiresAt = String(currentPlan.expires_at);
  return {
    id: String(currentPlan.plan_id),
    code: String(currentPlan.plan_code),
    name: String(currentPlan.plan_name),
    status: String(currentPlan.status),
    expiresAt,
    expiresAtLabel: formatDate(expiresAt),
  };
}

export async function buildMePayload(providers: IProviderRepository, user: Record<string, unknown>) {
  const currentPlan = await loadCurrentPlanSummary(providers, String(user.id), String(user.role));

  return sanitizeUser({
    id: String(user.id),
    role: String(user.role),
    name: String(user.name),
    email: String(user.email),
    phone: String(user.phone),
    address: user.address != null ? String(user.address) : null,
    cpf: user.cpf != null ? String(user.cpf) : null,
    radiusKm: user.radius_km != null ? Number(user.radius_km) : null,
    services: (user.services as string[] | null) ?? null,
    cep: user.cep != null ? String(user.cep) : null,
    cepLat: user.cep_lat != null ? Number(user.cep_lat) : null,
    cepLng: user.cep_lng != null ? Number(user.cep_lng) : null,
    workCep: user.work_cep != null ? String(user.work_cep) : null,
    workAddress: user.work_address != null ? String(user.work_address) : null,
    workLat: user.work_lat != null ? Number(user.work_lat) : null,
    workLng: user.work_lng != null ? Number(user.work_lng) : null,
    photoUrl: user.photo_url != null ? String(user.photo_url) : null,
    verificationStatus: user.verification_status ?? "unverified",
    verificationDocumentUrl: user.verification_document_url ?? null,
    verificationSelfieUrl: user.verification_selfie_url ?? null,
    passwordHash: String(user.password_hash),
    createdAt: String(user.created_at),
    updatedAt: String(user.updated_at),
    currentPlan,
  });
}
