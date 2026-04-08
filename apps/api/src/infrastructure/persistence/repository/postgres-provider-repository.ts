import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type { IProviderRepository } from "../../../domain/ports/repositories/provider-repository.js";
import { pool as defaultPool } from "../pool.js";
import { StatusEnum } from "../../../domain/value-objects/status-enum.js";
import type { ProviderPlanId, ProviderPlanPaymentMethod } from "../../../domain/value-objects/provider-plan.js";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export class PostgresProviderRepository implements IProviderRepository {
  constructor(private readonly db: Pool = defaultPool) {}

  async listActiveRequests(providerId: string) {
    const activeStatuses = [StatusEnum.OPEN, StatusEnum.ACCEPTED, StatusEnum.CONFIRMED];
    const result = await this.db.query(
      `SELECT r.id, r.service_id, r.service_subtype, r.description, r.created_at, r.updated_at, r.status, r.agreed_value,
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
      `SELECT r.id, r.service_id, r.service_subtype, r.description, r.completed_at, r.updated_at, r.agreed_value, u.name as client_name,
              ra.id AS rating_id, ra.rating, ra.review, ra.tags, ra.provider_response
       FROM requests r
       LEFT JOIN users u ON u.id = r.client_id
       LEFT JOIN ratings ra ON ra.request_id = r.id
       WHERE r.provider_id = $1 AND r.status = 'completed'
       ORDER BY r.completed_at DESC NULLS LAST, r.updated_at DESC`,
      [providerId]
    );
    return result.rows;
  }

  async refreshExpiredPlanSubscriptions(providerId: string, currentAt: string) {
    await this.db.query(
      `UPDATE provider_plan_subscriptions
       SET status = 'expired', updated_at = $2
       WHERE provider_id = $1
         AND status = 'active'
         AND expires_at <= $2`,
      [providerId, currentAt]
    );
  }

  async listPlans() {
    const result = await this.db.query(
      `SELECT id, code, name, description, price, billing_cycle_days, features, sort_order
       FROM provider_subscription_plans
       WHERE is_active = true
       ORDER BY sort_order ASC, price ASC`
    );
    return result.rows;
  }

  async findPlanById(planId: ProviderPlanId) {
    const result = await this.db.query(
      `SELECT id, code, name, description, price, billing_cycle_days, features, sort_order
       FROM provider_subscription_plans
       WHERE id = $1
         AND is_active = true`,
      [planId]
    );
    return result.rows[0] ?? null;
  }

  async findCurrentPlanSubscription(providerId: string) {
    const result = await this.db.query(
      `SELECT
          s.id,
          s.provider_id,
          s.plan_id,
          s.status,
          s.starts_at,
          s.expires_at,
          s.cancelled_at,
          s.created_at,
          s.updated_at,
          p.code AS plan_code,
          p.name AS plan_name,
          p.description AS plan_description,
          p.price,
          p.billing_cycle_days,
          p.features
       FROM provider_plan_subscriptions s
       INNER JOIN provider_subscription_plans p ON p.id = s.plan_id
       WHERE s.provider_id = $1
         AND s.status = 'active'
       ORDER BY s.expires_at DESC, s.updated_at DESC
       LIMIT 1`,
      [providerId]
    );
    return result.rows[0] ?? null;
  }

  async listPlanPayments(providerId: string) {
    const result = await this.db.query(
      `SELECT
          pay.id,
          pay.provider_id,
          pay.plan_id,
          pay.subscription_id,
          pay.amount,
          pay.currency,
          pay.payment_method,
          pay.status,
          pay.coverage_starts_at,
          pay.coverage_ends_at,
          pay.paid_at,
          pay.mock_transaction_id,
          pay.pix_copy_paste,
          pay.card_last_four,
          pay.created_at,
          p.code AS plan_code,
          p.name AS plan_name
       FROM provider_plan_payments pay
       INNER JOIN provider_subscription_plans p ON p.id = pay.plan_id
       WHERE pay.provider_id = $1
       ORDER BY COALESCE(pay.paid_at, pay.created_at) DESC, pay.created_at DESC`,
      [providerId]
    );
    return result.rows;
  }

  async purchasePlan(input: {
    providerId: string;
    planId: ProviderPlanId;
    paymentMethod: ProviderPlanPaymentMethod;
    cardLastFour: string | null;
    pixCopyPaste: string | null;
    mockTransactionId: string;
    currentAt: string;
  }) {
    const client = await this.db.connect();

    try {
      await client.query("BEGIN");
      await this.refreshExpiredPlanSubscriptionsWithClient(client, input.providerId, input.currentAt);

      const plan = await this.findPlanByIdWithClient(client, input.planId);
      if (!plan) {
        throw new Error("PROVIDER_PLAN_NOT_FOUND");
      }

      const currentSubscription = await this.findCurrentPlanSubscriptionWithClient(client, input.providerId);
      const now = new Date(input.currentAt);
      const billingCycleDays = Number(plan.billing_cycle_days);

      let subscriptionId: string;
      let coverageStartAt: string;
      let coverageEndAt: string;

      if (currentSubscription && String(currentSubscription.plan_id) === input.planId) {
        const currentExpiration = new Date(String(currentSubscription.expires_at));
        const baseStart = currentExpiration > now ? currentExpiration : now;
        coverageStartAt = baseStart.toISOString();
        coverageEndAt = addDays(baseStart, billingCycleDays).toISOString();

        subscriptionId = String(currentSubscription.id);
        await client.query(
          `UPDATE provider_plan_subscriptions
           SET expires_at = $1, updated_at = $2
           WHERE id = $3`,
          [coverageEndAt, input.currentAt, subscriptionId]
        );
      } else {
        if (currentSubscription) {
          await client.query(
            `UPDATE provider_plan_subscriptions
             SET status = 'cancelled', cancelled_at = $1, updated_at = $1
             WHERE id = $2`,
            [input.currentAt, currentSubscription.id]
          );
        }

        subscriptionId = randomUUID();
        coverageStartAt = input.currentAt;
        coverageEndAt = addDays(now, billingCycleDays).toISOString();

        await client.query(
          `INSERT INTO provider_plan_subscriptions (
             id,
             provider_id,
             plan_id,
             status,
             starts_at,
             expires_at,
             cancelled_at,
             created_at,
             updated_at
           )
           VALUES ($1, $2, $3, 'active', $4, $5, NULL, $6, $7)`,
          [subscriptionId, input.providerId, input.planId, input.currentAt, coverageEndAt, input.currentAt, input.currentAt]
        );
      }

      const paymentId = randomUUID();
      await client.query(
        `INSERT INTO provider_plan_payments (
           id,
           provider_id,
           plan_id,
           subscription_id,
           amount,
           currency,
           payment_method,
           status,
           coverage_starts_at,
           coverage_ends_at,
           paid_at,
           mock_transaction_id,
           pix_copy_paste,
           card_last_four,
           created_at,
           updated_at
         )
         VALUES ($1, $2, $3, $4, $5, 'BRL', $6, 'paid', $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          paymentId,
          input.providerId,
          input.planId,
          subscriptionId,
          Number(plan.price),
          input.paymentMethod,
          coverageStartAt,
          coverageEndAt,
          input.currentAt,
          input.mockTransactionId,
          input.pixCopyPaste,
          input.cardLastFour,
          input.currentAt,
          input.currentAt,
        ]
      );

      const freshSubscription = await this.findSubscriptionByIdWithClient(client, subscriptionId);
      const freshPayment = await this.findPlanPaymentByIdWithClient(client, paymentId);

      await client.query("COMMIT");

      return {
        subscription: freshSubscription,
        payment: freshPayment,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async refreshExpiredPlanSubscriptionsWithClient(client: PoolClient, providerId: string, currentAt: string) {
    await client.query(
      `UPDATE provider_plan_subscriptions
       SET status = 'expired', updated_at = $2
       WHERE provider_id = $1
         AND status = 'active'
         AND expires_at <= $2`,
      [providerId, currentAt]
    );
  }

  private async findPlanByIdWithClient(client: PoolClient, planId: ProviderPlanId) {
    const result = await client.query(
      `SELECT id, code, name, description, price, billing_cycle_days, features, sort_order
       FROM provider_subscription_plans
       WHERE id = $1
         AND is_active = true`,
      [planId]
    );
    return result.rows[0] ?? null;
  }

  private async findCurrentPlanSubscriptionWithClient(client: PoolClient, providerId: string) {
    const result = await client.query(
      `SELECT
          s.id,
          s.provider_id,
          s.plan_id,
          s.status,
          s.starts_at,
          s.expires_at,
          s.cancelled_at,
          s.created_at,
          s.updated_at,
          p.code AS plan_code,
          p.name AS plan_name,
          p.description AS plan_description,
          p.price,
          p.billing_cycle_days,
          p.features
       FROM provider_plan_subscriptions s
       INNER JOIN provider_subscription_plans p ON p.id = s.plan_id
       WHERE s.provider_id = $1
         AND s.status = 'active'
       ORDER BY s.expires_at DESC, s.updated_at DESC
       LIMIT 1`,
      [providerId]
    );
    return result.rows[0] ?? null;
  }

  private async findSubscriptionByIdWithClient(client: PoolClient, subscriptionId: string) {
    const result = await client.query(
      `SELECT
          s.id,
          s.provider_id,
          s.plan_id,
          s.status,
          s.starts_at,
          s.expires_at,
          s.cancelled_at,
          s.created_at,
          s.updated_at,
          p.code AS plan_code,
          p.name AS plan_name,
          p.description AS plan_description,
          p.price,
          p.billing_cycle_days,
          p.features
       FROM provider_plan_subscriptions s
       INNER JOIN provider_subscription_plans p ON p.id = s.plan_id
       WHERE s.id = $1`,
      [subscriptionId]
    );
    return result.rows[0] ?? null;
  }

  private async findPlanPaymentByIdWithClient(client: PoolClient, paymentId: string) {
    const result = await client.query(
      `SELECT
          pay.id,
          pay.provider_id,
          pay.plan_id,
          pay.subscription_id,
          pay.amount,
          pay.currency,
          pay.payment_method,
          pay.status,
          pay.coverage_starts_at,
          pay.coverage_ends_at,
          pay.paid_at,
          pay.mock_transaction_id,
          pay.pix_copy_paste,
          pay.card_last_four,
          pay.created_at,
          p.code AS plan_code,
          p.name AS plan_name
       FROM provider_plan_payments pay
       INNER JOIN provider_subscription_plans p ON p.id = pay.plan_id
       WHERE pay.id = $1`,
      [paymentId]
    );
    return result.rows[0] ?? null;
  }

  async findVerificationByProviderId(providerId: string) {
    const result = await this.db.query(
      `SELECT id, role, verification_status, verification_document_url, verification_document_storage_key,
              verification_selfie_url, verification_selfie_storage_key
       FROM users WHERE id = $1`,
      [providerId]
    );
    return result.rows[0] ?? null;
  }

  async updateVerificationAssets(
    providerId: string,
    updates: {
      verificationDocumentUrl?: string | null;
      verificationDocumentStorageKey?: string | null;
      verificationSelfieUrl?: string | null;
      verificationSelfieStorageKey?: string | null;
      verificationStatus?: "unverified" | "pending" | "verified" | "rejected";
    }
  ) {
    const sets: string[] = [];
    const values: Array<string | null> = [];
    let idx = 1;
    if (updates.verificationDocumentUrl !== undefined) {
      sets.push(`verification_document_url = $${idx++}`);
      values.push(updates.verificationDocumentUrl);
    }
    if (updates.verificationDocumentStorageKey !== undefined) {
      sets.push(`verification_document_storage_key = $${idx++}`);
      values.push(updates.verificationDocumentStorageKey);
    }
    if (updates.verificationSelfieUrl !== undefined) {
      sets.push(`verification_selfie_url = $${idx++}`);
      values.push(updates.verificationSelfieUrl);
    }
    if (updates.verificationSelfieStorageKey !== undefined) {
      sets.push(`verification_selfie_storage_key = $${idx++}`);
      values.push(updates.verificationSelfieStorageKey);
    }
    if (updates.verificationStatus !== undefined) {
      sets.push(`verification_status = $${idx++}`);
      values.push(updates.verificationStatus);
    }
    sets.push(`updated_at = $${idx++}`);
    values.push(new Date().toISOString());

    await this.db.query(`UPDATE users SET ${sets.join(", ")} WHERE id = $${idx}`, [...values, providerId]);
  }

  async listVerificationQueue(status: "pending" | "unverified" | "verified" | "rejected" = "pending") {
    const result = await this.db.query(
      `SELECT id, name, email, phone, cpf, verification_status, verification_document_url, verification_selfie_url, updated_at
       FROM users
       WHERE role = 'provider' AND verification_status = $1
       ORDER BY updated_at DESC`,
      [status]
    );
    return result.rows;
  }

  async findRatingForProviderResponse(providerId: string, ratingId: string) {
    const result = await this.db.query(
      `SELECT id, provider_id, provider_response
       FROM ratings
       WHERE id = $1 AND provider_id = $2`,
      [ratingId, providerId]
    );
    return result.rows[0] ?? null;
  }

  async updateRatingProviderResponse(params: { ratingId: string; response: string; now: string }) {
    await this.db.query(
      `UPDATE ratings
       SET provider_response = $1, provider_response_at = $2
       WHERE id = $3`,
      [params.response, params.now, params.ratingId]
    );
  }
}
