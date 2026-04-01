export type AuditLogInput = {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipHashPrefix: string | null;
  userAgentSnippet: string | null;
};

export interface IAuditLogWriter {
  append(entry: AuditLogInput): Promise<void>;
}
