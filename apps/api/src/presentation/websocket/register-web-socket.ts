import type { FastifyInstance } from "fastify";
import type { Role } from "../../domain/entities/role.js";
import type { IRequestRepository } from "../../domain/ports/request-repository.js";
import type { IRealtimeConnectionRegistry, WebSocketLike } from "../../domain/ports/realtime-connection-registry.js";
import { authorizeWebSocketConnection } from "../../application/websocket/authorize-web-socket-connection.js";

export function registerWebSocketRoute(
  app: FastifyInstance,
  requests: IRequestRepository,
  wsRegistry: IRealtimeConnectionRegistry
) {
  app.get(
    "/ws",
    { websocket: true },
    async (socket, request) => {
      const query = request.query as { token?: string; requestId?: string };
      const token = query?.token;
      if (!token) {
        socket.close(1008, "Token ausente");
        return;
      }

      let payload: { sub?: string; role?: string };
      try {
        payload = await app.jwt.verify(token);
      } catch {
        socket.close(1008, "Token inválido");
        return;
      }

      const userId = payload.sub;
      const userRole = payload.role as Role | undefined;
      if (!userId || (userRole !== "client" && userRole !== "provider")) {
        socket.close(1008, "Token inválido");
        return;
      }

      const requestId = query?.requestId;
      const auth = await authorizeWebSocketConnection(requests, {
        userId,
        role: userRole,
        requestId,
      });

      if (auth.ok === false) {
        socket.close(1008, auth.closeMessage);
        return;
      }

      const meta = {
        socket: socket as unknown as WebSocketLike,
        userId,
        role: userRole,
        requestId,
      };
      wsRegistry.register(meta);

      socket.on("close", () => wsRegistry.unregister(meta));
      socket.on("error", () => wsRegistry.unregister(meta));

      socket.send(JSON.stringify({ type: "connection.ready", requestId }));
    }
  );
}
