import type { Pool } from "pg";
import { pool as defaultPool } from "./pool.js";

export class PostgresClientRepository {
  constructor(private readonly db: Pool = defaultPool) {}

  async listRequests(clientId: string) {
    const result = await this.db.query(
      `SELECT r.id, r.service_id, r.description, r.status, r.created_at, r.updated_at, u.name as provider_name
       FROM requests r
       LEFT JOIN users u ON u.id = r.provider_id
       WHERE r.client_id = $1
       ORDER BY r.updated_at DESC`,
      [clientId]
    );
    return result.rows;
  }

  async listHistory(clientId: string) {
    const result = await this.db.query(
      `SELECT r.id, r.service_id, r.description, r.completed_at, r.updated_at, r.agreed_value,
              u.name as provider_name, ra.rating, ra.review
       FROM requests r
       LEFT JOIN users u ON u.id = r.provider_id
       LEFT JOIN ratings ra ON ra.request_id = r.id
       WHERE r.client_id = $1 AND r.status = 'completed'
       ORDER BY r.completed_at DESC NULLS LAST, r.updated_at DESC`,
      [clientId]
    );
    return result.rows;
  }

  async findRequestForRating(requestId: string) {
    const result = await this.db.query("SELECT id, client_id, provider_id, status FROM requests WHERE id = $1", [requestId]);
    return result.rows[0] ?? null;
  }

  async hasRating(requestId: string): Promise<boolean> {
    const result = await this.db.query("SELECT 1 FROM ratings WHERE request_id = $1", [requestId]);
    return Boolean(result.rowCount);
  }

  async insertRating(params: {
    id: string;
    requestId: string;
    clientId: string;
    providerId: string;
    rating: number;
    review: string | null;
    createdAt: string;
  }) {
    await this.db.query(
      `INSERT INTO ratings (id, request_id, client_id, provider_id, rating, review, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [params.id, params.requestId, params.clientId, params.providerId, params.rating, params.review, params.createdAt]
    );
  }
}
