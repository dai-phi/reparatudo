import type { Pool } from "pg";
import type { ServiceId } from "../../../domain/value-objects/service-id.js";
import { isServiceId } from "../../../domain/value-objects/service-id.js";
import type {
  IOpenJobRepository,
  OpenJobDiscoverRow,
  OpenJobRecord,
  OpenJobStatus,
  QuoteRecord,
  QuoteStatus,
  QuoteWithProvider,
} from "../../../domain/ports/repositories/open-job-repository.js";
import { pool as defaultPool } from "../pool.js";

function mapServiceId(raw: string): ServiceId {
  return isServiceId(raw) ? raw : "reparos";
}

function mapOpenJob(row: Record<string, unknown>): OpenJobRecord {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    serviceId: mapServiceId(String(row.service_id)),
    serviceSubtype: row.service_subtype != null ? String(row.service_subtype) : null,
    description: row.description != null ? String(row.description) : null,
    status: String(row.status) as OpenJobStatus,
    locationLat: row.location_lat != null ? Number(row.location_lat) : null,
    locationLng: row.location_lng != null ? Number(row.location_lng) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function mapQuote(row: Record<string, unknown>): QuoteRecord {
  return {
    id: String(row.id),
    openJobId: String(row.open_job_id),
    providerId: String(row.provider_id),
    amount: Number(row.amount),
    etaDays: row.eta_days != null ? Number(row.eta_days) : null,
    message: row.message != null ? String(row.message) : null,
    conditions: row.conditions != null ? String(row.conditions) : null,
    status: String(row.status) as QuoteStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class PostgresOpenJobRepository implements IOpenJobRepository {
  constructor(private readonly db: Pool = defaultPool) {}

  async insertOpenJob(params: {
    id: string;
    clientId: string;
    serviceId: ServiceId;
    serviceSubtype: string | null;
    description: string | null;
    status: OpenJobStatus;
    locationLat: number | null;
    locationLng: number | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO open_jobs (
        id, client_id, service_id, service_subtype, description, status, location_lat, location_lng, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        params.id,
        params.clientId,
        params.serviceId,
        params.serviceSubtype,
        params.description,
        params.status,
        params.locationLat,
        params.locationLng,
        params.createdAt,
        params.updatedAt,
      ]
    );
  }

  async findById(id: string): Promise<OpenJobRecord | null> {
    const result = await this.db.query("SELECT * FROM open_jobs WHERE id = $1", [id]);
    const row = result.rows[0];
    return row ? mapOpenJob(row) : null;
  }

  async findRequestIdByOpenJobId(openJobId: string): Promise<string | null> {
    const result = await this.db.query(
      `SELECT id FROM requests WHERE open_job_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [openJobId]
    );
    const row = result.rows[0];
    return row ? String(row.id) : null;
  }

  async listForClient(clientId: string): Promise<OpenJobRecord[]> {
    const result = await this.db.query(
      `SELECT * FROM open_jobs WHERE client_id = $1 ORDER BY created_at DESC`,
      [clientId]
    );
    return result.rows.map((r) => mapOpenJob(r));
  }

  async listDiscoverableForProvider(providerId: string): Promise<OpenJobDiscoverRow[]> {
    const result = await this.db.query(
      `SELECT oj.*, c.cep_lat AS client_lat, c.cep_lng AS client_lng, c.name AS client_name
       FROM open_jobs oj
       JOIN users c ON c.id = oj.client_id
       JOIN users p ON p.id = $1
       WHERE oj.status = 'open'
         AND p.services IS NOT NULL
         AND oj.service_id = ANY(p.services)
         AND NOT EXISTS (
           SELECT 1 FROM quotes q
           WHERE q.open_job_id = oj.id AND q.provider_id = $1
         )
       ORDER BY oj.created_at DESC`,
      [providerId]
    );
    return result.rows.map((row) => {
      const base = mapOpenJob(row);
      return {
        ...base,
        clientLat: Number(row.client_lat),
        clientLng: Number(row.client_lng),
        clientName: String(row.client_name),
      };
    });
  }

  async updateJobStatus(params: { id: string; status: OpenJobStatus; updatedAt: string }): Promise<void> {
    await this.db.query(`UPDATE open_jobs SET status = $1, updated_at = $2 WHERE id = $3`, [
      params.status,
      params.updatedAt,
      params.id,
    ]);
  }

  async insertQuote(params: {
    id: string;
    openJobId: string;
    providerId: string;
    amount: number;
    etaDays: number | null;
    message: string | null;
    conditions: string | null;
    status: QuoteStatus;
    createdAt: string;
    updatedAt: string;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO quotes (
        id, open_job_id, provider_id, amount, eta_days, message, conditions, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        params.id,
        params.openJobId,
        params.providerId,
        params.amount,
        params.etaDays,
        params.message,
        params.conditions,
        params.status,
        params.createdAt,
        params.updatedAt,
      ]
    );
  }

  async findQuoteById(id: string): Promise<QuoteRecord | null> {
    const result = await this.db.query("SELECT * FROM quotes WHERE id = $1", [id]);
    const row = result.rows[0];
    return row ? mapQuote(row) : null;
  }

  async listQuotesWithProviders(openJobId: string): Promise<QuoteWithProvider[]> {
    const result = await this.db.query(
      `SELECT q.*, u.name AS provider_name, u.photo_url AS provider_photo_url,
              u.verification_status AS provider_verification_status
       FROM quotes q
       JOIN users u ON u.id = q.provider_id
       WHERE q.open_job_id = $1
       ORDER BY q.created_at DESC`,
      [openJobId]
    );
    return result.rows.map((row) => ({
      ...mapQuote(row),
      providerName: String(row.provider_name),
      providerPhotoUrl: row.provider_photo_url != null ? String(row.provider_photo_url) : null,
      providerVerified: row.provider_verification_status === "verified",
    }));
  }

  async hasQuoteFromProvider(openJobId: string, providerId: string): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM quotes WHERE open_job_id = $1 AND provider_id = $2 LIMIT 1`,
      [openJobId, providerId]
    );
    return Boolean(result.rowCount);
  }

  async rejectPendingQuotesExcept(params: {
    openJobId: string;
    exceptQuoteId: string;
    updatedAt: string;
  }): Promise<void> {
    await this.db.query(
      `UPDATE quotes SET status = 'rejected', updated_at = $1
       WHERE open_job_id = $2 AND id <> $3 AND status = 'pending'`,
      [params.updatedAt, params.openJobId, params.exceptQuoteId]
    );
  }

  async rejectAllPendingForOpenJob(openJobId: string, updatedAt: string): Promise<void> {
    await this.db.query(
      `UPDATE quotes SET status = 'rejected', updated_at = $1
       WHERE open_job_id = $2 AND status = 'pending'`,
      [updatedAt, openJobId]
    );
  }

  async updateQuoteStatus(params: { id: string; status: QuoteStatus; updatedAt: string }): Promise<void> {
    await this.db.query(`UPDATE quotes SET status = $1, updated_at = $2 WHERE id = $3`, [
      params.status,
      params.updatedAt,
      params.id,
    ]);
  }

  async countOpenByClientAndService(clientId: string, serviceId: ServiceId): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*)::int AS c FROM open_jobs
       WHERE client_id = $1 AND service_id = $2 AND status = 'open'`,
      [clientId, serviceId]
    );
    return Number(result.rows[0]?.c ?? 0);
  }

  async acceptQuoteAndCreateRequest(params: {
    quoteId: string;
    openJobId: string;
    requestId: string;
    clientId: string;
    providerId: string;
    serviceId: ServiceId;
    serviceSubtype: string | null;
    description: string | null;
    agreedValue: number;
    locationLat: number | null;
    locationLng: number | null;
    now: string;
    systemMessageId: string;
    systemMessageText: string;
  }): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE quotes SET status = 'rejected', updated_at = $1
         WHERE open_job_id = $2 AND id <> $3 AND status = 'pending'`,
        [params.now, params.openJobId, params.quoteId]
      );

      await client.query(`UPDATE quotes SET status = 'accepted', updated_at = $1 WHERE id = $2`, [
        params.now,
        params.quoteId,
      ]);

      await client.query(`UPDATE open_jobs SET status = 'awarded', updated_at = $1 WHERE id = $2`, [
        params.now,
        params.openJobId,
      ]);

      await client.query(
        `INSERT INTO requests (
          id, client_id, provider_id, service_id, service_subtype, description, status,
          location_lat, location_lng, open_job_id, agreed_value, accepted_at,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'accepted', $7, $8, $9, $10, $11, $11, $11)`,
        [
          params.requestId,
          params.clientId,
          params.providerId,
          params.serviceId,
          params.serviceSubtype,
          params.description,
          params.locationLat,
          params.locationLng,
          params.openJobId,
          params.agreedValue,
          params.now,
        ]
      );

      await client.query(
        `INSERT INTO messages (id, request_id, from_role, text, created_at)
         VALUES ($1, $2, 'system', $3, $4)`,
        [params.systemMessageId, params.requestId, params.systemMessageText, params.now]
      );

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
