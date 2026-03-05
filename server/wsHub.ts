import WebSocket from "ws";
import type { Role } from "./db.js";

type EventPayload = {
  type: string;
  requestId?: string;
  payload?: unknown;
};

interface ConnectionMeta {
  socket: WebSocket;
  userId: string;
  role: Role;
  requestId?: string;
}

const requestChannels = new Map<string, Set<ConnectionMeta>>();
const userChannels = new Map<string, Set<ConnectionMeta>>();

function safeSend(socket: WebSocket, data: EventPayload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

function registerChannel(map: Map<string, Set<ConnectionMeta>>, key: string, meta: ConnectionMeta) {
  let set = map.get(key);
  if (!set) {
    set = new Set();
    map.set(key, set);
  }
  set.add(meta);
}

function unregisterChannel(map: Map<string, Set<ConnectionMeta>>, key: string, meta: ConnectionMeta) {
  const set = map.get(key);
  if (!set) return;
  set.delete(meta);
  if (set.size === 0) {
    map.delete(key);
  }
}

export function registerConnection(meta: ConnectionMeta) {
  if (meta.requestId) {
    registerChannel(requestChannels, meta.requestId, meta);
  }
  registerChannel(userChannels, meta.userId, meta);
}

export function unregisterConnection(meta: ConnectionMeta) {
  if (meta.requestId) {
    unregisterChannel(requestChannels, meta.requestId, meta);
  }
  unregisterChannel(userChannels, meta.userId, meta);
}

export function broadcastToRequest(requestId: string, event: Omit<EventPayload, "requestId">) {
  const channels = requestChannels.get(requestId);
  if (!channels) return;
  const payload = { ...event, requestId };
  for (const client of channels) {
    safeSend(client.socket, payload);
  }
}

export function broadcastToUser(userId: string, event: EventPayload) {
  const channels = userChannels.get(userId);
  if (!channels) return;
  for (const client of channels) {
    safeSend(client.socket, event);
  }
}
