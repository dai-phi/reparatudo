export type LoginThrottleRow = {
  failCount: number;
  windowStartedAt: Date;
  lastFailAt: Date;
  lockedUntil: Date | null;
};

export interface ILoginThrottleStore {
  findById(id: string): Promise<LoginThrottleRow | null>;
  deleteById(id: string): Promise<void>;
  upsertFailure(params: {
    id: string;
    now: Date;
    windowMs: number;
    lockAfterFails: number;
    lockDurationMs: number;
  }): Promise<{ failCount: number; lockedUntil: Date | null }>;
}
