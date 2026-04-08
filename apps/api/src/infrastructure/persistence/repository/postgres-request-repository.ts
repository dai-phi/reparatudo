import type { Pool } from "pg";
import type { Role } from "../../../domain/entities/role.js";
import type { RequestRecord } from "../../../domain/entities/records.js";
import type { ServiceId } from "../../../domain/value-objects/service-id.js";
import { isServiceId } from "../../../domain/value-objects/service-id.js";
import type {
  IRequestRepository,
  MessageRow,
  RequestParticipants,
  ProviderPreview,
  ClientPreview,
} from "../../../domain/ports/repositories/request-repository.js";
import { pool as defaultPool } from "../pool.js";

function mapRequestRow(row: Record<string, unknown>): RequestRecord {
  const sid = String(row.service_id);
  const serviceId: ServiceId = isServiceId(sid) ? sid : "reparos";
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    providerId: row.provider_id != null ? String(row.provider_id) : null,
    serviceId,
    serviceSubtype: row.service_subtype != null ? String(row.service_subtype) : null,
    description: row.description != null ? String(row.description) : null,
    status: String(row.status),
    agreedValue: row.agreed_value != null ? Number(row.agreed_value) : null,
    clientConfirmed: row.client_confirmed != null ? Boolean(row.client_confirmed) : null,
    providerConfirmed: row.provider_confirmed != null ? Boolean(row.provider_confirmed) : null,
    acceptedAt: row.accepted_at != null ? String(row.accepted_at) : null,
    confirmedAt: row.confirmed_at != null ? String(row.confirmed_at) : null,
    cancellationReason: row.cancellation_reason != null ? String(row.cancellation_reason) : null,
    locationLat: row.location_lat != null ? Number(row.location_lat) : null,
    locationLng: row.location_lng != null ? Number(row.location_lng) : null,
    openJobId: row.open_job_id != null ? String(row.open_job_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at != null ? String(row.completed_at) : null,
  };
}

export class PostgresRequestRepository implements IRequestRepository {
  constructor(private readonly db: Pool = defaultPool) {}

  async findById(id: string): Promise<RequestRecord | null> {
    const result = await this.db.query("SELECT * FROM requests WHERE id = $1", [id]);
    const row = result.rows[0];
    return row ? mapRequestRow(row) : null;
  }

  async findRequestParticipants(requestId: string): Promise<RequestParticipants | null> {
    const result = await this.db.query("SELECT client_id, provider_id FROM requests WHERE id = $1", [requestId]);
    const row = result.rows[0];
    if (!row) return null;
    return {
      clientId: String(row.client_id),
      providerId: row.provider_id != null ? String(row.provider_id) : null,
    };
  }

  async ensureParticipant(requestId: string, userId: string, role: Role): Promise<RequestRecord | null> {
    const target = await this.findById(requestId);
    if (!target) return null;
    if (role === "client" && target.clientId !== userId) return null;
    if (role === "provider" && target.providerId !== userId) return null;
    return target;
  }

  async insertRequest(params: {
    id: string;
    clientId: string;
    providerId: string;
    serviceId: ServiceId;
    serviceSubtype: string | null;
    description: string | null;
    status: string;
    locationLat: number | null;
    locationLng: number | null;
    openJobId?: string | null;
    agreedValue?: number | null;
    acceptedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO requests (
        id, client_id, provider_id, service_id, service_subtype, description, status,
        location_lat, location_lng, open_job_id, agreed_value, accepted_at,
        created_at, updated_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        params.id,
        params.clientId,
        params.providerId,
        params.serviceId,
        params.serviceSubtype,
        params.description,
        params.status,
        params.locationLat,
        params.locationLng,
        params.openJobId ?? null,
        params.agreedValue ?? null,
        params.acceptedAt ?? null,
        params.createdAt,
        params.updatedAt,
      ]
    );
  }

  async insertMessage(params: {
    id: string;
    requestId: string;
    fromRole: "client" | "provider" | "system";
    text: string;
    createdAt: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO messages (id, request_id, from_role, text, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [params.id, params.requestId, params.fromRole, params.text, params.createdAt]
    );
  }

  async listMessages(requestId: string): Promise<MessageRow[]> {
    const result = await this.db.query(
      `SELECT id, from_role, text, created_at
       FROM messages
       WHERE request_id = $1
       ORDER BY created_at ASC`,
      [requestId]
    );
    return result.rows as MessageRow[];
  }

  async updateAccept(params: { requestId: string; providerId: string; now: string }): Promise<void> {
    await this.db.query(
      `UPDATE requests SET provider_id = $1, status = $2, accepted_at = $3, updated_at = $3 WHERE id = $4`,
      [params.providerId, "accepted", params.now, params.requestId]
    );
  }

  async updateReject(params: { requestId: string; now: string }): Promise<void> {
    await this.db.query(`UPDATE requests SET status = $1, updated_at = $2 WHERE id = $3`, [
      "rejected",
      params.now,
      params.requestId,
    ]);
  }

  async updateCancel(params: { requestId: string; now: string; reason: string | null }): Promise<void> {
    await this.db.query(`UPDATE requests SET status = $1, cancellation_reason = $2, updated_at = $3 WHERE id = $4`, [
      "cancelled",
      params.reason,
      params.now,
      params.requestId,
    ]);
  }

  async updateComplete(params: { requestId: string; now: string }): Promise<void> {
    await this.db.query(`UPDATE requests SET status = $1, completed_at = $2, updated_at = $2 WHERE id = $3`, [
      "completed",
      params.now,
      params.requestId,
    ]);
  }

  async confirmStep(params: {
    requestId: string;
    role: Role;
    agreedValue: number | null;
    now: string;
  }): Promise<void> {
    const updates: string[] = [];
    const values: Array<string | number | boolean | null> = [];
    let idx = 1;

    if (params.role === "client") {
      updates.push(`client_confirmed = $${idx++}`);
      values.push(true);
    } else {
      updates.push(`provider_confirmed = $${idx++}`);
      values.push(true);
      if (params.agreedValue != null && params.agreedValue > 0) {
        updates.push(`agreed_value = $${idx++}`);
        values.push(params.agreedValue);
      }
    }

    updates.push(`updated_at = $${idx++}`);
    values.push(params.now);
    values.push(params.requestId);

    await this.db.query(`UPDATE requests SET ${updates.join(", ")} WHERE id = $${idx}`, values);
  }

  async setConfirmedStatus(params: { requestId: string; now: string }): Promise<void> {
    await this.db.query(
      `UPDATE requests SET status = $1, confirmed_at = $2, updated_at = $2 WHERE id = $3`,
      ["confirmed", params.now, params.requestId]
    );
  }

  async getDetailsExtras(params: {
    clientId: string;
    providerId: string | null;
  }): Promise<{
    provider: ProviderPreview | null;
    client: ClientPreview | null;
    ratingAvg: number;
  }> {
    const providerResult = params.providerId
      ? await this.db.query("SELECT id, name, phone, photo_url, work_lat, work_lng FROM users WHERE id = $1", [
          params.providerId,
        ])
      : { rows: [] };
    const clientResult = await this.db.query("SELECT id, name, cep_lat, cep_lng FROM users WHERE id = $1", [
      params.clientId,
    ]);
    const ratingsResult = params.providerId
      ? await this.db.query("SELECT AVG(rating) as rating_avg FROM ratings WHERE provider_id = $1", [params.providerId])
      : { rows: [] };

    const providerRow = providerResult.rows[0];
    const clientRow = clientResult.rows[0];
    const ratingAvg = ratingsResult.rows[0]?.rating_avg ? Number(ratingsResult.rows[0].rating_avg) : 0;

    const provider: ProviderPreview | null = providerRow
      ? {
          id: String(providerRow.id),
          name: String(providerRow.name),
          phone: String(providerRow.phone),
          photoUrl: providerRow.photo_url ?? null,
          workLat: providerRow.work_lat != null ? Number(providerRow.work_lat) : null,
          workLng: providerRow.work_lng != null ? Number(providerRow.work_lng) : null,
        }
      : null;

    const client: ClientPreview | null = clientRow
      ? {
          id: String(clientRow.id),
          name: String(clientRow.name),
          cepLat: clientRow.cep_lat != null ? Number(clientRow.cep_lat) : null,
          cepLng: clientRow.cep_lng != null ? Number(clientRow.cep_lng) : null,
        }
      : null;

    return { provider, client, ratingAvg };
  }

  async updateProviderLastService(params: {
    providerId: string;
    lat: number;
    lng: number;
    now: string;
  }): Promise<void> {
    await this.db.query(
      `UPDATE users SET last_service_lat = $1, last_service_lng = $2, last_service_at = $3, updated_at = $3 WHERE id = $4`,
      [params.lat, params.lng, params.now, params.providerId]
    );
  }

  async insertIncident(params: {
    id: string;
    requestId: string;
    reporterId: string;
    reporterRole: "client" | "provider";
    targetUserId: string | null;
    type: string;
    description: string;
    attachments: string[];
    status: "open" | "in_review" | "resolved" | "rejected";
    createdAt: string;
    updatedAt: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO incidents (
        id, request_id, reporter_id, reporter_role, target_user_id, type, description, attachments, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text[], $9, $10, $11)`,
      [
        params.id,
        params.requestId,
        params.reporterId,
        params.reporterRole,
        params.targetUserId,
        params.type,
        params.description,
        params.attachments,
        params.status,
        params.createdAt,
        params.updatedAt,
      ]
    );
  }
}
