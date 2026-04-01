import type { IUserRepository } from "../../domain/ports/user-repository.js";
import type { IPasswordHasher } from "../../domain/ports/password-hasher.js";
import type { IPasswordResetTokenStore } from "../../domain/ports/password-reset-token-store.js";
import { hashPasswordResetToken } from "./request-password-reset.js";

export type CompletePasswordResetResult =
  | { ok: true; userId: string }
  | { ok: false; message: string };

export async function completePasswordReset(
  deps: {
    users: IUserRepository;
    passwordHasher: IPasswordHasher;
    tokens: IPasswordResetTokenStore;
  },
  input: { token: string; password: string }
): Promise<CompletePasswordResetResult> {
  const plain = input.token.trim();
  if (plain.length < 64) {
    return { ok: false, message: "Link invalido ou expirado." };
  }

  const tokenHash = hashPasswordResetToken(plain);
  const userId = await deps.tokens.consumeIfValid(tokenHash);
  if (!userId) {
    return { ok: false, message: "Link invalido ou expirado." };
  }

  const passwordHash = await deps.passwordHasher.hash(input.password);
  const now = new Date().toISOString();
  await deps.users.updatePasswordHash(userId, passwordHash, now);
  return { ok: true, userId };
}
