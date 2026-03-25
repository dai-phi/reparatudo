import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import { initDb } from "./infrastructure/persistence/init-db.js";
import { PostgresUserRepository } from "./infrastructure/persistence/repository/postgres-user-repository.js";
import { PostgresRequestRepository } from "./infrastructure/persistence/repository/postgres-request-repository.js";
import { PostgresClientRepository } from "./infrastructure/persistence/repository/postgres-client-repository.js";
import { PostgresProviderRepository } from "./infrastructure/persistence/repository/postgres-provider-repository.js";
import { PostgresProfileRepository } from "./infrastructure/persistence/repository/postgres-profile-repository.js";
import { PostgresProviderSearchRepository } from "./infrastructure/persistence/repository/postgres-provider-search-repository.js";
import { PostgresGeoService } from "./infrastructure/geo/postgres-geo-service.js";
import { BcryptPasswordHasher } from "./infrastructure/auth/password-hasher.js";
import { RealtimeBroadcasterAdapter } from "./infrastructure/realtime/realtime-broadcaster-adapter.js";
import { createEmailSender } from "./infrastructure/email/create-email-sender.js";
import { registerAuthenticate } from "./presentation/http/register-authenticate.js";
import { registerAuthRoutes } from "./presentation/http/routes/auth.js";
import { registerMeRoutes } from "./presentation/http/routes/me.js";
import { registerClientRoutes } from "./presentation/http/routes/client.js";
import { registerProviderRoutes } from "./presentation/http/routes/provider.js";
import { registerRequestRoutes } from "./presentation/http/routes/requests.js";
import { registerProviderSearchRoutes } from "./presentation/http/routes/providers.js";
import { registerWebSocketRoute } from "./presentation/websocket/register-web-socket.js";

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
const clients = new PostgresClientRepository();
const providers = new PostgresProviderRepository();
const profiles = new PostgresProfileRepository();
const providerSearch = new PostgresProviderSearchRepository();
const geo = new PostgresGeoService();
const passwordHasher = new BcryptPasswordHasher();
const realtime = new RealtimeBroadcasterAdapter();
const email = createEmailSender();

registerAuthenticate(app);
registerWebSocketRoute(app, requests);

app.get("/health", async () => ({ status: "ok" }));

await initDb();

await registerAuthRoutes(app, { users, geo, passwordHasher });
await registerMeRoutes(app, profiles, users);
await registerClientRoutes(app, clients);
await registerProviderRoutes(app, providers);
await registerRequestRoutes(app, { users, requests, geo, realtime, email });
await registerProviderSearchRoutes(app, providerSearch);

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
