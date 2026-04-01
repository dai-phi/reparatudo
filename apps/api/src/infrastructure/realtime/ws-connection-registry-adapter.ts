import type {
  IRealtimeConnectionRegistry,
  RealtimeConnectionMeta,
} from "../../domain/ports/realtime-connection-registry.js";
import { registerConnection, unregisterConnection } from "./ws-hub.js";
import type { ConnectionMeta } from "./ws-hub.js";

function toHubMeta(meta: RealtimeConnectionMeta): ConnectionMeta {
  return meta as unknown as ConnectionMeta;
}

export function createRealtimeConnectionRegistry(): IRealtimeConnectionRegistry {
  return {
    register(meta: RealtimeConnectionMeta) {
      registerConnection(toHubMeta(meta));
    },
    unregister(meta: RealtimeConnectionMeta) {
      unregisterConnection(toHubMeta(meta));
    },
  };
}
