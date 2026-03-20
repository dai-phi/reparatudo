import { useEffect, useRef } from "react";
import { API_URL, getToken } from "./api";
import type { ChatMessage, RequestDetails, RequestSummary } from "./api";

const normalizeUrl = (value: string) => value.replace(/\/$/, "");
const ensureWsProtocol = (value: string) => {
  if (value.startsWith("ws://") || value.startsWith("wss://")) {
    return value;
  }
  if (value.startsWith("https://")) {
    return value.replace(/^https:/, "wss:");
  }
  if (value.startsWith("http://")) {
    return value.replace(/^http:/, "ws:");
  }
  return `ws://${value}`;
};

const BASE_URL = ensureWsProtocol(normalizeUrl(import.meta.env.VITE_WS_URL ?? API_URL));
const WS_ENDPOINT = `${BASE_URL}/ws`;

export type WebsocketStatus = "connecting" | "open" | "closed" | "error";

export type WebsocketEvent =
  | { type: "connection.ready"; requestId?: string }
  | { type: "chat.message"; requestId: string; payload: ChatMessage }
  | { type: "request.updated"; requestId: string; payload: RequestDetails }
  | { type: "provider.request"; requestId: string; payload: RequestSummary };

export interface UseWebsocketOptions {
  requestId?: string;
  enabled?: boolean;
  onEvent: (event: WebsocketEvent) => void;
  onStatus?: (status: WebsocketStatus) => void;
}

export function useWebsocket(options: UseWebsocketOptions) {
  const { requestId, enabled = true, onEvent, onStatus } = options;
  const handlerRef = useRef(onEvent);
  const statusRef = useRef(onStatus);

  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    statusRef.current = onStatus;
  }, [onStatus]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    const token = getToken();
    if (!token) {
      return;
    }

    const url = new URL(WS_ENDPOINT);
    url.searchParams.set("token", token);
    if (requestId) {
      url.searchParams.set("requestId", requestId);
    }

    const socket = new WebSocket(url.toString());
    statusRef.current?.("connecting");
    socket.addEventListener("open", () => statusRef.current?.("open"));
    socket.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(event.data) as WebsocketEvent;
        handlerRef.current?.(payload);
      } catch (error) {
        // ignore invalid payloads
      }
    });
    socket.addEventListener("close", () => statusRef.current?.("closed"));
    socket.addEventListener("error", () => statusRef.current?.("error"));

    return () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000);
      }
    };
  }, [enabled, requestId]);
}
