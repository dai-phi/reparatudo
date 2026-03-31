import type { Pool } from "pg";
import type { IUserRepository, RegisterClientInput, RegisterProviderInput, ProviderForRequest } from "../../../domain/ports/user-repository.js";
import type { UserRecord } from "../../../domain/entities/records.js";
import type { ServiceId } from "../../../domain/value-objects/service-id.js";
import { isServiceId } from "../../../domain/value-objects/service-id.js";
import { pool as defaultPool } from "../pool.js";

function mapUserRow(row: Record<string, unknown>): UserRecord {
  const services = row.services as string[] | null;
  return {
    id: String(row.id),
    role: row.role as UserRecord["role"],
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone),
    cep: row.cep != null ? String(row.cep) : null,
    cepLat: row.cep_lat != null ? Number(row.cep_lat) : null,
    cepLng: row.cep_lng != null ? Number(row.cep_lng) : null,
    workCep: row.work_cep != null ? String(row.work_cep) : null,
    workLat: row.work_lat != null ? Number(row.work_lat) : null,
    workLng: row.work_lng != null ? Number(row.work_lng) : null,
    workAddress: row.work_address != null ? String(row.work_address) : null,
    photoUrl: row.photo_url != null ? String(row.photo_url) : null,
    verificationDocumentUrl:
      row.verification_document_url != null ? String(row.verification_document_url) : null,
    address: row.address != null ? String(row.address) : null,
    cpf: row.cpf != null ? String(row.cpf) : null,
    radiusKm: row.radius_km != null ? Number(row.radius_km) : null,
    services: services?.filter((s): s is ServiceId => isServiceId(s)) ?? null,
    passwordHash: String(row.password_hash),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly db: Pool = defaultPool) {}

  async existsByEmailLower(email: string): Promise<boolean> {
    const result = await this.db.query("SELECT 1 FROM users WHERE lower(email) = $1", [email]);
    return Boolean(result.rowCount);
  }

  async existsByPhoneDigits(phoneDigits: string, excludeUserId?: string): Promise<boolean> {
    if (phoneDigits.length < 8) return false;
    if (excludeUserId) {
      const result = await this.db.query(
        `SELECT 1 FROM users
         WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1
         AND id <> $2`,
        [phoneDigits, excludeUserId]
      );
      return Boolean(result.rowCount);
    }
    const result = await this.db.query(
      "SELECT 1 FROM users WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1",
      [phoneDigits]
    );
    return Boolean(result.rowCount);
  }

  async existsByCpfDigits(cpfDigits: string, excludeUserId?: string): Promise<boolean> {
    if (cpfDigits.length !== 11) return false;
    if (excludeUserId) {
      const result = await this.db.query(
        `SELECT 1 FROM users
         WHERE regexp_replace(coalesce(cpf, ''), '[^0-9]', '', 'g') = $1
         AND id <> $2`,
        [cpfDigits, excludeUserId]
      );
      return Boolean(result.rowCount);
    }
    const result = await this.db.query(
      `SELECT 1 FROM users
       WHERE regexp_replace(coalesce(cpf, ''), '[^0-9]', '', 'g') = $1`,
      [cpfDigits]
    );
    return Boolean(result.rowCount);
  }

  async insertClient(input: RegisterClientInput): Promise<void> {
    await this.db.query(
      `INSERT INTO users (id, role, name, email, phone, cpf, cep, cep_lat, cep_lng, address, password_hash, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        input.id,
        "client",
        input.name,
        input.email,
        input.phone,
        input.cpf,
        input.cep,
        input.cepLat,
        input.cepLng,
        input.address,
        input.passwordHash,
        input.createdAt,
        input.updatedAt,
      ]
    );
  }

  async insertProvider(input: RegisterProviderInput): Promise<void> {
    await this.db.query(
      `INSERT INTO users (id, role, name, email, phone, cpf, radius_km, services, work_cep, work_lat, work_lng, work_address, password_hash,
        photo_url, photo_storage_key, verification_document_url, verification_document_storage_key, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        input.id,
        "provider",
        input.name,
        input.email,
        input.phone,
        input.cpf,
        input.radiusKm,
        input.services,
        input.workCep,
        input.workLat,
        input.workLng,
        input.workAddress,
        input.passwordHash,
        input.photoUrl ?? null,
        input.photoStorageKey ?? null,
        input.verificationDocumentUrl ?? null,
        input.verificationDocumentStorageKey ?? null,
        input.createdAt,
        input.updatedAt,
      ]
    );
  }

  async findByEmailLower(email: string): Promise<UserRecord | null> {
    const result = await this.db.query("SELECT * FROM users WHERE lower(email) = $1", [email]);
    const row = result.rows[0];
    return row ? mapUserRow(row) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const result = await this.db.query("SELECT * FROM users WHERE id = $1", [id]);
    const row = result.rows[0];
    return row ? mapUserRow(row) : null;
  }

  async getClientNameById(id: string): Promise<string | null> {
    const result = await this.db.query("SELECT id, name FROM users WHERE id = $1", [id]);
    return result.rows[0]?.name ?? null;
  }

  async getClientCoords(id: string): Promise<{ lat: number; lng: number } | null> {
    const result = await this.db.query("SELECT cep_lat, cep_lng FROM users WHERE id = $1", [id]);
    const row = result.rows[0];
    if (!row?.cep_lat || !row?.cep_lng) return null;
    return { lat: Number(row.cep_lat), lng: Number(row.cep_lng) };
  }

  async findProviderForService(providerId: string, serviceId: ServiceId): Promise<ProviderForRequest | null> {
    const result = await this.db.query(
      "SELECT id, name, radius_km, work_lat, work_lng FROM users WHERE id = $1 AND role = 'provider' AND $2 = ANY(services)",
      [providerId, serviceId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      name: String(row.name),
      radiusKm: row.radius_km != null ? Number(row.radius_km) : null,
      workLat: row.work_lat != null ? Number(row.work_lat) : null,
      workLng: row.work_lng != null ? Number(row.work_lng) : null,
    };
  }
}
