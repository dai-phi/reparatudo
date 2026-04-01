import type { Pool } from "pg";
import type { IProviderSearchRepository } from "../../../domain/ports/repositories/provider-search-repository.js";
import { pool as defaultPool } from "../pool.js";
import type { ServiceId } from "../../../domain/value-objects/service-id.js";

export class PostgresProviderSearchRepository implements IProviderSearchRepository {
  constructor(private readonly db: Pool = defaultPool) {}

  async findClientCoords(clientId: string) {
    const result = await this.db.query("SELECT cep, cep_lat, cep_lng FROM users WHERE id = $1", [clientId]);
    return result.rows[0] ?? null;
  }

  async listProvidersByService(serviceId: ServiceId) {
    const result = await this.db.query(
      `SELECT u.id, u.name, u.photo_url, u.radius_km, u.work_lat, u.work_lng, u.verification_status,
              u.last_service_lat, u.last_service_lng, u.last_service_at,
              COALESCE(AVG(r.rating), 0) as rating_avg,
              COALESCE(AVG(EXTRACT(EPOCH FROM (req.accepted_at - req.created_at)) / 60), 9999) as avg_response
       FROM users u
       LEFT JOIN ratings r ON r.provider_id = u.id
       LEFT JOIN requests req ON req.provider_id = u.id AND req.accepted_at IS NOT NULL
       WHERE u.role = 'provider' AND $1 = ANY(u.services)
       GROUP BY u.id
       ORDER BY avg_response ASC`,
      [serviceId]
    );
    return result.rows;
  }
}
