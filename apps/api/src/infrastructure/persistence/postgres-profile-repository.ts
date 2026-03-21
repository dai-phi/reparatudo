import type { Pool } from "pg";
import { pool as defaultPool } from "./pool.js";

export class PostgresProfileRepository {
  constructor(private readonly db: Pool = defaultPool) {}

  async findById(userId: string) {
    const result = await this.db.query("SELECT * FROM users WHERE id = $1", [userId]);
    return result.rows[0] ?? null;
  }

  async updateById(userId: string, updates: string[], values: Array<string | number | null>) {
    const idx = values.length + 1;
    await this.db.query(`UPDATE users SET ${updates.join(", ")} WHERE id = $${idx} `, [...values, userId]);
  }
}
