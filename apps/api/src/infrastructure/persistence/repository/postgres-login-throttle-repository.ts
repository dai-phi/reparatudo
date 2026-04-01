import type { ILoginThrottleStore, LoginThrottleRow } from "../../../domain/ports/login-throttle-store.js";
import { pool } from "../pool.js";

function mapRow(r: {
  fail_count: number;
  window_started_at: Date;
  last_fail_at: Date;
  locked_until: Date | null;
}): LoginThrottleRow {
  return {
    failCount: r.fail_count,
    windowStartedAt: new Date(r.window_started_at),
    lastFailAt: new Date(r.last_fail_at),
    lockedUntil: r.locked_until ? new Date(r.locked_until) : null,
  };
}

export class PostgresLoginThrottleRepository implements ILoginThrottleStore {
  async findById(id: string): Promise<LoginThrottleRow | null> {
    const { rows } = await pool.query<{
      fail_count: number;
      window_started_at: Date;
      last_fail_at: Date;
      locked_until: Date | null;
    }>(
      `SELECT fail_count, window_started_at, last_fail_at, locked_until FROM login_throttle WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return null;
    return mapRow(rows[0]);
  }

  async deleteById(id: string): Promise<void> {
    await pool.query(`DELETE FROM login_throttle WHERE id = $1`, [id]);
  }

  async upsertFailure(params: {
    id: string;
    now: Date;
    windowMs: number;
    lockAfterFails: number;
    lockDurationMs: number;
  }): Promise<{ failCount: number; lockedUntil: Date | null }> {
    const { id, now, windowMs, lockAfterFails, lockDurationMs } = params;
    const nowIso = now.toISOString();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows: sel } = await client.query<{
        fail_count: number;
        window_started_at: Date;
        last_fail_at: Date;
        locked_until: Date | null;
      }>(`SELECT fail_count, window_started_at, last_fail_at, locked_until FROM login_throttle WHERE id = $1 FOR UPDATE`, [id]);

      if (!sel[0]) {
        await client.query(
          `
            INSERT INTO login_throttle (id, fail_count, window_started_at, last_fail_at, locked_until)
            VALUES ($1, 1, $2, $2, NULL)
          `,
          [id, nowIso]
        );
        await client.query("COMMIT");
        return { failCount: 1, lockedUntil: null };
      }

      const row = sel[0];
      const windowStart = new Date(row.window_started_at).getTime();
      const elapsed = now.getTime() - windowStart;
      let failCount: number;
      let lockedUntil: Date | null = row.locked_until ? new Date(row.locked_until) : null;

      if (elapsed > windowMs) {
        failCount = 1;
        lockedUntil = null;
        await client.query(
          `
            UPDATE login_throttle
            SET fail_count = 1, window_started_at = $2, last_fail_at = $2, locked_until = NULL
            WHERE id = $1
          `,
          [id, nowIso]
        );
      } else {
        failCount = row.fail_count + 1;
        if (failCount >= lockAfterFails) {
          lockedUntil = new Date(now.getTime() + lockDurationMs);
        }
        await client.query(
          `
            UPDATE login_throttle
            SET fail_count = $2, last_fail_at = $3, locked_until = $4
            WHERE id = $1
          `,
          [id, failCount, nowIso, lockedUntil ? lockedUntil.toISOString() : null]
        );
      }

      await client.query("COMMIT");
      return { failCount, lockedUntil };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
