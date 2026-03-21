import { pool } from "./pool.js";

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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_service_lat DOUBLE PRECISION;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_service_lng DOUBLE PRECISION;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_service_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS work_address TEXT;
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
}
