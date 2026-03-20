import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { initDb } from "./db.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerClientRoutes } from "./routes/client.js";
import { registerProviderRoutes } from "./routes/provider.js";
import { registerRequestRoutes } from "./routes/requests.js";
import { registerMeRoutes } from "./routes/me.js";
import { registerProviderSearchRoutes } from "./routes/providers.js";
import { pool } from "./db.js";
import { registerConnection, unregisterConnection } from "./wsHub.js";
import type { Role } from "./db.js";

const app = Fastify({ logger: true });

const jwtSecret = process.env.JWT_SECRET || "dev-secret";

await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(cookie, {
  secret: jwtSecret,
});

await app.register(jwt, {
  secret: jwtSecret,
});

await app.register(websocket);

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
    if (requestId) {
      const result = await pool.query(
        "SELECT client_id, provider_id FROM requests WHERE id = $1",
        [requestId]
      );
      const row = result.rows[0];
      if (!row) {
        socket.close(1008, "Pedido não encontrado");
        return;
      }
      const isAllowed =
        (userRole === "client" && row.client_id === userId) ||
        (userRole === "provider" && row.provider_id === userId);
      if (!isAllowed) {
        socket.close(1008, "Acesso negado");
        return;
      }
    }

    const meta = { socket, userId, role: userRole, requestId };
    registerConnection(meta);

    socket.on("close", () => unregisterConnection(meta));
    socket.on("error", () => unregisterConnection(meta));

    socket.send(JSON.stringify({ type: "connection.ready", requestId }));
  }
);

app.decorate("authenticate", async function (request: any, reply: any) {
  const token =
    request.cookies?.token ||
    (request.headers.authorization?.startsWith("Bearer ")
      ? request.headers.authorization.slice(7)
      : null);
  if (!token) {
    return reply.code(401).send({ message: "Nao autorizado" });
  }
  try {
    const decoded = await app.jwt.verify(token);
    request.user = decoded;
  } catch {
    return reply.code(401).send({ message: "Nao autorizado" });
  }
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: unknown, reply: unknown) => Promise<void>;
  }
}

app.get("/health", async () => ({ status: "ok" }));

await initDb();

await registerAuthRoutes(app);
await registerMeRoutes(app);
await registerClientRoutes(app);
await registerProviderRoutes(app);
await registerRequestRoutes(app);
await registerProviderSearchRoutes(app);

const port = Number(process.env.PORT || 3333);
const host = process.env.HOST || "0.0.0.0";

app
  .listen({ port, host })
  .then(() => {
    app.log.info(`API rodando em http://${host}:${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
