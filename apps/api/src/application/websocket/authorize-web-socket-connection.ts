import type { Role } from "../../domain/entities/role.js";
import type { IRequestRepository } from "../../domain/ports/request-repository.js";

export type WsAuthInput = {
  userId: string;
  role: Role;
  requestId?: string;
};

export type WsAuthResult =
  | { ok: true }
  | { ok: false; closeMessage: string };

export async function authorizeWebSocketConnection(
  requests: IRequestRepository,
  input: WsAuthInput
): Promise<WsAuthResult> {
  if (!input.requestId) {
    return { ok: true };
  }

  const row = await requests.findRequestParticipants(input.requestId);
  if (!row) {
    return { ok: false, closeMessage: "Pedido não encontrado" };
  }

  const isAllowed =
    (input.role === "client" && row.clientId === input.userId) ||
    (input.role === "provider" && row.providerId === input.userId);

  if (!isAllowed) {
    return { ok: false, closeMessage: "Acesso negado" };
  }

  return { ok: true };
}
