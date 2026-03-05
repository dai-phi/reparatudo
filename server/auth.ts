import bcrypt from "bcryptjs";
import type { UserRecord } from "./db.js";

export async function hashSecret(secret: string) {
  return bcrypt.hash(secret, 10);
}

export async function verifySecret(secret: string, hash: string) {
  return bcrypt.compare(secret, hash);
}

export function sanitizeUser(user: UserRecord & { secretHash?: string }) {
  if ("passwordHash" in user) {
    const { passwordHash, ...safe } = user as UserRecord;
    return safe;
  }
  const { secretHash, ...safe } = user;
  return safe;
}
