import { NO_DESCRIPTION } from "../../domain/value-objects/messages.js";
import { SERVICE_LABELS } from "../../domain/value-objects/service-id.js";
import { RequestStatusLabel, StatusEnum } from "../../domain/value-objects/status-enum.js";
import { formatCurrency, formatDate, formatRelativeTime } from "../utils/format.js";

export function getClientRequestStatusMeta(status: string): { label: string; chatOpen: boolean } {
  switch (status) {
    case StatusEnum.OPEN:
      return { label: RequestStatusLabel.WAITING_PROVIDER, chatOpen: true };
    case StatusEnum.ACCEPTED:
      return { label: "Em negociação", chatOpen: true };
    case StatusEnum.CONFIRMED:
      return { label: "Serviço confirmado", chatOpen: true };
    case StatusEnum.COMPLETED:
      return { label: "Finalizado", chatOpen: false };
    case StatusEnum.CANCELLED:
      return { label: "Cancelado", chatOpen: false };
    case StatusEnum.REJECTED:
      return { label: "Recusado", chatOpen: false };
    default:
      return { label: status, chatOpen: false };
  }
}

export function mapClientRequestRow(row: Record<string, unknown>) {
  const meta = getClientRequestStatusMeta(String(row.status));
  return {
    id: row.id,
    provider: row.provider_name ?? "Prestador",
    service: SERVICE_LABELS[row.service_id as keyof typeof SERVICE_LABELS] ?? row.service_id,
    desc: row.description || NO_DESCRIPTION,
    status: String(row.status),
    statusLabel: meta.label,
    chatOpen: meta.chatOpen,
    time: formatRelativeTime(String(row.updated_at)),
  };
}

export function mapClientHistoryRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    provider: row.provider_name ?? "Prestador",
    service: SERVICE_LABELS[row.service_id as keyof typeof SERVICE_LABELS] ?? row.service_id,
    desc: row.description || NO_DESCRIPTION,
    date: formatDate(String(row.completed_at || row.updated_at)),
    value: formatCurrency(Number(row.agreed_value || 0)),
    rated: Boolean(row.rating),
    rating: row.rating ? Number(row.rating) : 0,
    review: row.review || "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    providerResponse: row.provider_response || "",
  };
}
