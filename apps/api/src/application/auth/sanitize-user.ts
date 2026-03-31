type SanitizableRecord = {
  passwordHash?: unknown;
  secretHash?: unknown;
};

export type SanitizedUser<T extends SanitizableRecord> = Omit<T, "passwordHash" | "secretHash">;

export function sanitizeUser<T extends SanitizableRecord>(user: T): SanitizedUser<T> {
  const u = user as T & Record<string, unknown>;
  const { passwordHash: _p, secretHash: _s, ...rest } = u;
  return rest as SanitizedUser<T>;
}
