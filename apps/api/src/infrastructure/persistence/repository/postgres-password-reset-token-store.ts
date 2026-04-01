import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type {
  IPasswordResetTokenStore,
  PasswordResetTokenInsert,
} from "../../../domain/ports/password-reset-token-store.js";
import { pool as defaultPool } from "../pool.js";

export class PostgresPasswordResetTokenStore implements IPasswordResetTokenStore {
  constructor(private readonly db: Pool = defaultPool) {}

  async replaceForUser(input: PasswordResetTokenInsert): Promise<void> {
    const id = randomUUID();
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [input.userId]);
      await client.query(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz)`,
        [id, input.userId, input.tokenHash, input.expiresAtIso, input.createdAtIso]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async consumeIfValid(tokenHash: string): Promise<string | null> {
    const result = await this.db.query<{ user_id: string }>(
      `DELETE FROM password_reset_tokens
       WHERE token_hash = $1 AND expires_at > NOW()
       RETURNING user_id`,
      [tokenHash]
    );
    const row = result.rows[0];
    return row?.user_id ? String(row.user_id) : null;
  }
}
