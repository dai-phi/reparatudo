import { createHash, randomBytes } from "node:crypto";
import type { IUserRepository } from "../../domain/ports/repositories/user-repository.js";
import type { IEmailSender } from "../../domain/ports/email-sender.js";
import type { IPasswordResetTokenStore } from "../../domain/ports/password-reset-token-store.js";

const TOKEN_BYTES = 32;
const EXPIRY_MS = 60 * 60 * 1000;

function hashToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

export async function requestPasswordReset(
  deps: {
    users: IUserRepository;
    email: IEmailSender;
    tokens: IPasswordResetTokenStore;
    appPublicUrl: string;
  },
  input: { email: string }
): Promise<void> {
  const emailLower = input.email.toLowerCase().trim();
  const user = await deps.users.findByEmailLower(emailLower);
  if (!user) return;

  const plain = randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = hashToken(plain);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EXPIRY_MS);
  const nowIso = now.toISOString();

  await deps.tokens.replaceForUser({
    userId: user.id,
    tokenHash,
    expiresAtIso: expiresAt.toISOString(),
    createdAtIso: nowIso,
  });

  const base = deps.appPublicUrl.replace(/\/$/, "");
  const link = `${base}/reset-password?token=${encodeURIComponent(plain)}`;

  const subject = "Redefinicao de senha - Repara Tudo";
  const text = `Ola, ${user.name}.\n\nVoce pediu para redefinir sua senha. Acesse o link abaixo (valido por 1 hora):\n\n${link}\n\nSe nao foi voce, ignore este e-mail.\n`;

  await deps.email.send({ to: user.email, subject, text });
}

export { hashToken as hashPasswordResetToken };
