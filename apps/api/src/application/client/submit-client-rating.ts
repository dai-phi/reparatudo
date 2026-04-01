import { randomUUID } from "node:crypto";
import type { IClientRepository } from "../../domain/ports/repositories/client-repository.js";

export type SubmitClientRatingInput = {
  requestId: string;
  rating: number;
  review?: string | null;
  tags?: ("pontual" | "limpo" | "educado" | "comunicativo" | "resolutivo")[];
};

export type SubmitClientRatingResult =
  | { ok: true }
  | { ok: false; status: 400 | 404 | 409; message: string };

export async function submitClientRating(
  deps: { clients: IClientRepository },
  params: { clientId: string; input: SubmitClientRatingInput }
): Promise<SubmitClientRatingResult> {
  const { clients } = deps;
  const { clientId, input } = params;

  const target = await clients.findRequestForRating(input.requestId);

  if (!target || target.client_id !== clientId) {
    return { ok: false, status: 404, message: "Serviço nao encontrado" };
  }

  if (target.status !== "completed") {
    return { ok: false, status: 400, message: "Serviço ainda nao finalizado" };
  }

  if (!target.provider_id) {
    return { ok: false, status: 400, message: "Prestador não definido" };
  }

  const already = await clients.hasRating(target.id);
  if (already) {
    return { ok: false, status: 409, message: "Serviço já avaliado" };
  }

  await clients.insertRating({
    id: randomUUID(),
    requestId: target.id,
    clientId,
    providerId: target.provider_id,
    rating: input.rating,
    review: input.review?.trim() || null,
    tags: input.tags ?? [],
    createdAt: new Date().toISOString(),
  });

  return { ok: true };
}
