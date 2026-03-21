import type { IRealtimeBroadcaster, RealtimeEvent } from "../../domain/ports/realtime-broadcaster.js";
import * as wsHub from "./ws-hub.js";

export class RealtimeBroadcasterAdapter implements IRealtimeBroadcaster {
  broadcastToRequest(requestId: string, event: Omit<RealtimeEvent, "requestId">): void {
    wsHub.broadcastToRequest(requestId, event);
  }

  broadcastToUser(userId: string, event: RealtimeEvent): void {
    wsHub.broadcastToUser(userId, event);
  }
}
