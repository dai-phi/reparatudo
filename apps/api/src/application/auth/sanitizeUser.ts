import type { UserRecord } from "../../domain/entities/records.js";

export type SanitizedUser = Omit<UserRecord, "passwordHash">;

export function sanitizeUser(user: UserRecord & { secretHash?: string }): SanitizedUser {
  const u = user as unknown as Record<string, unknown>;
  const { passwordHash: _p, secretHash: _s, ...rest } = u;
  return rest as SanitizedUser;
}
