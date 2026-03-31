import { pool } from "./pool.js";
import { PROVIDER_PLAN_CATALOG } from "../../domain/value-objects/provider-plan.js";

export async function initDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL nao definido");
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      cep TEXT,
      cep_lat DOUBLE PRECISION,
      cep_lng DOUBLE PRECISION,
      work_cep TEXT,
      work_lat DOUBLE PRECISION,
      work_lng DOUBLE PRECISION,
      photo_url TEXT,
      address TEXT,
      cpf TEXT,
      radius_km INTEGER,
      services TEXT[],
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      service_id TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      agreed_value NUMERIC,
      client_confirmed BOOLEAN DEFAULT false,
      provider_confirmed BOOLEAN DEFAULT false,
      accepted_at TIMESTAMPTZ,
      confirmed_at TIMESTAMPTZ,
      cancellation_reason TEXT,
      location_lat DOUBLE PRECISION,
      location_lng DOUBLE PRECISION,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      completed_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      from_role TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      client_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL,
      review TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      UNIQUE (request_id)
    );

    CREATE TABLE IF NOT EXISTS cep_cache (
      cep TEXT PRIMARY KEY,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_requests_provider ON requests(provider_id);
    CREATE INDEX IF NOT EXISTS idx_requests_client ON requests(client_id);
    CREATE INDEX IF NOT EXISTS idx_messages_request ON messages(request_id);
    CREATE INDEX IF NOT EXISTS idx_ratings_provider ON ratings(provider_id);

    CREATE TABLE IF NOT EXISTS provider_payments (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount NUMERIC(12, 2) NOT NULL,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'cartao_credito', 'cartao_debito')),
      status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'cancelled')),
      reference_month DATE NOT NULL,
      paid_at TIMESTAMPTZ NOT NULL,
      pix_copy_paste TEXT,
      card_last_four TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_provider_payments_provider ON provider_payments(provider_id);
    CREATE INDEX IF NOT EXISTS idx_provider_payments_ref ON provider_payments(provider_id, reference_month);

    CREATE TABLE IF NOT EXISTS provider_subscription_plans (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price NUMERIC(12, 2) NOT NULL,
      billing_cycle_days INTEGER NOT NULL DEFAULT 30,
      features TEXT[] NOT NULL DEFAULT '{}',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provider_plan_subscriptions (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL REFERENCES provider_subscription_plans(id) ON DELETE RESTRICT,
      status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
      starts_at TIMESTAMPTZ NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      cancelled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provider_plan_payments (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL REFERENCES provider_subscription_plans(id) ON DELETE RESTRICT,
      subscription_id TEXT NOT NULL REFERENCES provider_plan_subscriptions(id) ON DELETE CASCADE,
      amount NUMERIC(12, 2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'BRL',
      payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit_card', 'debit_card')),
      status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
      coverage_starts_at TIMESTAMPTZ NOT NULL,
      coverage_ends_at TIMESTAMPTZ NOT NULL,
      paid_at TIMESTAMPTZ,
      mock_transaction_id TEXT NOT NULL,
      pix_copy_paste TEXT,
      card_last_four TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_provider_plan_subscriptions_provider ON provider_plan_subscriptions(provider_id);
    CREATE INDEX IF NOT EXISTS idx_provider_plan_subscriptions_status ON provider_plan_subscriptions(provider_id, status);
    CREATE INDEX IF NOT EXISTS idx_provider_plan_payments_provider ON provider_plan_payments(provider_id);
    CREATE INDEX IF NOT EXISTS idx_provider_plan_payments_subscription ON provider_plan_payments(subscription_id);
  `);

  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS cep TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS cep_lat DOUBLE PRECISION;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS cep_lng DOUBLE PRECISION;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS work_cep TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS work_lat DOUBLE PRECISION;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS work_lng DOUBLE PRECISION;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS client_confirmed BOOLEAN DEFAULT false;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS provider_confirmed BOOLEAN DEFAULT false;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
    ALTER TABLE requests ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_service_lat DOUBLE PRECISION;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_service_lng DOUBLE PRECISION;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_service_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS work_address TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_storage_key TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_document_url TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_document_storage_key TEXT;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'photo_cloudinary_public_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'photo_storage_key'
      ) THEN
        ALTER TABLE users RENAME COLUMN photo_cloudinary_public_id TO photo_storage_key;
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'verification_document_public_id'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'verification_document_storage_key'
      ) THEN
        ALTER TABLE users RENAME COLUMN verification_document_public_id TO verification_document_storage_key;
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF to_regclass('public.pagamento') IS NOT NULL THEN
        INSERT INTO provider_payments (
          id, provider_id, amount, payment_method, status, reference_month, paid_at, pix_copy_paste, card_last_four, created_at, updated_at
        )
        SELECT
          id,
          provider_id,
          ROUND(valor_centavos::numeric / 100, 2),
          forma_pagamento,
          CASE status
            WHEN 'pendente' THEN 'pending'
            WHEN 'pago' THEN 'paid'
            WHEN 'cancelado' THEN 'cancelled'
            ELSE 'paid'
          END,
          referencia_competencia,
          data_pagamento,
          pix_copia_e_cola,
          cartao_ultimos_4,
          created_at,
          updated_at
        FROM pagamento
        ON CONFLICT (id) DO NOTHING;
        DROP TABLE pagamento;
      END IF;
    END $$;
  `);

  const now = new Date().toISOString();
  for (const plan of PROVIDER_PLAN_CATALOG) {
    await pool.query(
      `
        INSERT INTO provider_subscription_plans (
          id,
          code,
          name,
          description,
          price,
          billing_cycle_days,
          features,
          sort_order,
          is_active,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::text[], $8, true, $9, $10)
        ON CONFLICT (id) DO UPDATE
        SET
          code = EXCLUDED.code,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          price = EXCLUDED.price,
          billing_cycle_days = EXCLUDED.billing_cycle_days,
          features = EXCLUDED.features,
          sort_order = EXCLUDED.sort_order,
          is_active = EXCLUDED.is_active,
          updated_at = EXCLUDED.updated_at
      `,
      [
        plan.id,
        plan.code,
        plan.name,
        plan.description,
        plan.price,
        plan.billingCycleDays,
        [...plan.features],
        plan.sortOrder,
        now,
        now,
      ]
    );
  }
}
