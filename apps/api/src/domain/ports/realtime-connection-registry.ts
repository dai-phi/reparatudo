import type { Role } from "../entities/role.js";

/**
 * Minimal socket surface used by the realtime hub (avoid coupling domain to `ws` types).
 */
export interface WebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  on(event: "close" | "error", listener: () => void): void;
}

export type RealtimeConnectionMeta = {
  socket: WebSocketLike;
  userId: string;
  role: Role;
  requestId?: string;
};

export interface IRealtimeConnectionRegistry {
  register(meta: RealtimeConnectionMeta): void;
  unregister(meta: RealtimeConnectionMeta): void;
}
