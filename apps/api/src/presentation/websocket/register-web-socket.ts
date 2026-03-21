import type { FastifyInstance } from "fastify";
import type { Role } from "../../domain/entities/role.js";
import type { IRequestRepository } from "../../domain/ports/request-repository.js";
import { authorizeWebSocketConnection } from "../../application/websocket/authorize-web-socket-connection.js";
import { registerConnection, unregisterConnection } from "../../infrastructure/realtime/ws-hub.js";

export function registerWebSocketRoute(app: FastifyInstance, requests: IRequestRepository) {
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

      const meta = { socket, userId, role: userRole, requestId };
      registerConnection(meta);

      socket.on("close", () => unregisterConnection(meta));
      socket.on("error", () => unregisterConnection(meta));

      socket.send(JSON.stringify({ type: "connection.ready", requestId }));
    }
  );
}
