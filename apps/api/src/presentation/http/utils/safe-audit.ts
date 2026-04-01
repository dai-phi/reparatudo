import type { FastifyBaseLogger } from "fastify";
import type { AuditLogInput, IAuditLogWriter } from "../../../domain/ports/audit-log-writer.js";

export async function safeAuditAppend(
  audit: IAuditLogWriter | undefined,
  log: FastifyBaseLogger,
  entry: AuditLogInput
): Promise<void> {
  if (!audit) return;
  try {
    await audit.append(entry);
  } catch (err) {
    log.error({ err }, "audit_log_append_failed");
  }
}
