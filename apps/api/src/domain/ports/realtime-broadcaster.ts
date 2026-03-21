export type RealtimeEvent = {
  type: string;
  requestId?: string;
  payload?: unknown;
};

export interface IRealtimeBroadcaster {
  broadcastToRequest(requestId: string, event: Omit<RealtimeEvent, "requestId">): void;
  broadcastToUser(userId: string, event: RealtimeEvent): void;
}
