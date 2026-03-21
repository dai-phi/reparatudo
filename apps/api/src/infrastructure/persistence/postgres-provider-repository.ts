import type { Pool } from "pg";
import { pool as defaultPool } from "./pool.js";
import { StatusEnum } from "../../domain/value-objects/status-enum.js";

export class PostgresProviderRepository {
  constructor(private readonly db: Pool = defaultPool) {}

  async listActiveRequests(providerId: string) {
    const activeStatuses = [StatusEnum.OPEN, StatusEnum.ACCEPTED, StatusEnum.CONFIRMED];
    const result = await this.db.query(
      `SELECT r.id, r.service_id, r.description, r.created_at, r.updated_at, r.status, r.agreed_value,
              r.client_confirmed, r.provider_confirmed, u.name as client_name
       FROM requests r
       LEFT JOIN users u ON u.id = r.client_id
       WHERE r.provider_id = $1 AND r.status = ANY($2::text[])
       ORDER BY
         CASE WHEN r.status = $3 THEN 0 ELSE 1 END,
         r.updated_at DESC`,
      [providerId, activeStatuses, StatusEnum.CONFIRMED]
    );
    return result.rows;
  }

  async getCompletedStats(providerId: string) {
    const completedResult = await this.db.query(
      `SELECT COUNT(*)::int as total, COALESCE(SUM(agreed_value), 0) as earnings
       FROM requests
       WHERE provider_id = $1 AND status = $2`,
      [providerId, StatusEnum.COMPLETED]
    );

    const ratingResult = await this.db.query(
      `SELECT AVG(rating) as rating_avg
       FROM ratings
       WHERE provider_id = $1`,
      [providerId]
    );

    return {
      completed: completedResult.rows[0],
      rating: ratingResult.rows[0],
    };
  }

  async listHistory(providerId: string) {
    const result = await this.db.query(
      `SELECT r.id, r.service_id, r.description, r.completed_at, r.updated_at, r.agreed_value, u.name as client_name
       FROM requests r
       LEFT JOIN users u ON u.id = r.client_id
       WHERE r.provider_id = $1 AND r.status = 'completed'
       ORDER BY r.completed_at DESC NULLS LAST, r.updated_at DESC`,
      [providerId]
    );
    return result.rows;
  }

  async findProviderCreatedAt(providerId: string) {
    const result = await this.db.query(`SELECT created_at FROM users WHERE id = $1 AND role = 'provider'`, [providerId]);
    return result.rows[0] ?? null;
  }

  async listPaidReferenceMonths(providerId: string) {
    const result = await this.db.query(
      `SELECT reference_month::text as k FROM provider_payments
       WHERE provider_id = $1 AND status = 'paid'`,
      [providerId]
    );
    return result.rows;
  }

  async listPayments(providerId: string) {
    const result = await this.db.query(
      `SELECT id, amount, payment_method, status, reference_month, paid_at, pix_copy_paste, card_last_four, created_at
       FROM provider_payments WHERE provider_id = $1 ORDER BY paid_at DESC, created_at DESC`,
      [providerId]
    );
    return result.rows;
  }

  async listPaidReferenceMonthsRaw(providerId: string) {
    const result = await this.db.query(
      `SELECT reference_month FROM provider_payments WHERE provider_id = $1 AND status = 'paid'`,
      [providerId]
    );
    return result.rows;
  }

  async insertPayment(params: {
    id: string;
    providerId: string;
    amount: number;
    paymentMethod: "pix" | "cartao_credito" | "cartao_debito";
    referenceMonth: string;
    paidAt: string;
    pixCopyPaste: string | null;
    cardLastFour: string | null;
    createdAt: string;
    updatedAt: string;
  }) {
    await this.db.query(
      `INSERT INTO provider_payments (id, provider_id, amount, payment_method, status, reference_month, paid_at, pix_copy_paste, card_last_four, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'paid', $5, $6, $7, $8, $9, $10)`,
      [
        params.id,
        params.providerId,
        params.amount,
        params.paymentMethod,
        params.referenceMonth,
        params.paidAt,
        params.pixCopyPaste,
        params.cardLastFour,
        params.createdAt,
        params.updatedAt,
      ]
    );
  }
}
