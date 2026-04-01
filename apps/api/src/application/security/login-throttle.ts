import { createHmac } from "node:crypto";
import type { ILoginThrottleStore } from "../../domain/ports/login-throttle-store.js";

const WINDOW_MS = 15 * 60 * 1000;
const LOCK_AFTER_FAILS = 8;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export function progressiveDelayMs(failCountAfterRecord: number): number {
  if (failCountAfterRecord < 2) return 0;
  const tier = Math.min(failCountAfterRecord - 1, 6);
  return Math.min(100 * 2 ** tier, 3200);
}

export function loginThrottleKey(secret: string, emailLower: string, clientIp: string): string {
  return createHmac("sha256", secret).update(`${emailLower}|${clientIp}`).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class LoginThrottleService {
  constructor(
    private readonly store: ILoginThrottleStore,
    private readonly secret: string
  ) {}

  keyFor(emailLower: string, clientIp: string): string {
    return loginThrottleKey(this.secret, emailLower, clientIp);
  }

  async isLocked(id: string, now: Date): Promise<{ locked: boolean; lockedUntil?: Date }> {
    const row = await this.store.findById(id);
    if (!row) return { locked: false };
    if (row.lockedUntil && row.lockedUntil > now) {
      return { locked: true, lockedUntil: row.lockedUntil };
    }
    if (row.lockedUntil && row.lockedUntil <= now) {
      await this.store.deleteById(id);
    }
    return { locked: false };
  }

  async onFailedLogin(emailLower: string, clientIp: string, now: Date): Promise<void> {
    const id = this.keyFor(emailLower, clientIp);
    const { failCount } = await this.store.upsertFailure({
      id,
      now,
      windowMs: WINDOW_MS,
      lockAfterFails: LOCK_AFTER_FAILS,
      lockDurationMs: LOCK_DURATION_MS,
    });
    const delay = progressiveDelayMs(failCount);
    if (delay > 0) await sleep(delay);
  }

  async onSuccessfulLogin(emailLower: string, clientIp: string): Promise<void> {
    const id = this.keyFor(emailLower, clientIp);
    await this.store.deleteById(id);
  }
}
