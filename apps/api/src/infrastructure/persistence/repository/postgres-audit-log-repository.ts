import { randomUUID } from "node:crypto";
import type { AuditLogInput, IAuditLogWriter } from "../../../domain/ports/audit-log-writer.js";
import { pool } from "../pool.js";

export class PostgresAuditLogRepository implements IAuditLogWriter {
  async append(entry: AuditLogInput): Promise<void> {
    const id = randomUUID();
    const now = new Date().toISOString();
    await pool.query(
      `
        INSERT INTO audit_logs (
          id,
          created_at,
          actor_user_id,
          action,
          entity_type,
          entity_id,
          metadata,
          ip_hash_prefix,
          user_agent_snippet
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
      `,
      [
        id,
        now,
        entry.actorUserId,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.ipHashPrefix,
        entry.userAgentSnippet,
      ]
    );
  }
}
