import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { initDb } from "./infrastructure/persistence/initDb.js";
import { PostgresUserRepository } from "./infrastructure/persistence/postgresUserRepository.js";
import { PostgresRequestRepository } from "./infrastructure/persistence/postgresRequestRepository.js";
import { PostgresGeoService } from "./infrastructure/geo/postgresGeoService.js";
import { BcryptPasswordHasher } from "./infrastructure/auth/bcryptPasswordHasher.js";
import { RealtimeBroadcasterAdapter } from "./infrastructure/realtime/realtimeBroadcasterAdapter.js";
import { registerAuthenticate } from "./presentation/http/registerAuthenticate.js";
import { registerAuthRoutes } from "./presentation/http/routes/auth.js";
import { registerMeRoutes } from "./presentation/http/routes/me.js";
import { registerClientRoutes } from "./presentation/http/routes/client.js";
import { registerProviderRoutes } from "./presentation/http/routes/provider.js";
import { registerRequestRoutes } from "./presentation/http/routes/requests.js";
import { registerProviderSearchRoutes } from "./presentation/http/routes/providers.js";
import { registerWebSocketRoute } from "./presentation/websocket/registerWebSocket.js";

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

const users = new PostgresUserRepository();
const requests = new PostgresRequestRepository();
const geo = new PostgresGeoService();
const passwordHasher = new BcryptPasswordHasher();
const realtime = new RealtimeBroadcasterAdapter();

registerAuthenticate(app);
registerWebSocketRoute(app, requests);

app.get("/health", async () => ({ status: "ok" }));

await initDb();

await registerAuthRoutes(app, { users, geo, passwordHasher });
await registerMeRoutes(app);
await registerClientRoutes(app);
await registerProviderRoutes(app);
await registerRequestRoutes(app, { users, requests, geo, realtime });
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
