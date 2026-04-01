import type { FastifyInstance } from "fastify";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import { LoginThrottleService } from "./application/security/login-throttle.js";
import { initDb } from "./infrastructure/persistence/init-db.js";
import { PostgresUserRepository } from "./infrastructure/persistence/repository/postgres-user-repository.js";
import { PostgresRequestRepository } from "./infrastructure/persistence/repository/postgres-request-repository.js";
import { PostgresClientRepository } from "./infrastructure/persistence/repository/postgres-client-repository.js";
import { PostgresProviderRepository } from "./infrastructure/persistence/repository/postgres-provider-repository.js";
import { PostgresProfileRepository } from "./infrastructure/persistence/repository/postgres-profile-repository.js";
import { PostgresProviderSearchRepository } from "./infrastructure/persistence/repository/postgres-provider-search-repository.js";
import { PostgresOpenJobRepository } from "./infrastructure/persistence/repository/postgres-open-job-repository.js";
import { PostgresAuditLogRepository } from "./infrastructure/persistence/repository/postgres-audit-log-repository.js";
import { PostgresLoginThrottleRepository } from "./infrastructure/persistence/repository/postgres-login-throttle-repository.js";
import { PostgresPasswordResetTokenStore } from "./infrastructure/persistence/repository/postgres-password-reset-token-store.js";
import { CloudinaryService } from "./infrastructure/cloudinary/cloudinary-service.js";
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
import { registerOpenJobRoutes } from "./presentation/http/routes/open-jobs.js";
import { registerLegalRoutes } from "./presentation/http/routes/legal.js";
import { registerWebSocketRoute } from "./presentation/websocket/register-web-socket.js";
import { createIpRateLimiter } from "./presentation/http/middleware/ip-rate-limit.js";

const FIFTEEN_MIN = 15 * 60 * 1000;

function createCloudinaryServiceOrNull(): CloudinaryService | null {
  try {
    return new CloudinaryService();
  } catch {
    return null;
  }
}

export type BuildAppOptions = {
  logger?: boolean;
};

export async function buildApp(options?: BuildAppOptions): Promise<FastifyInstance> {
  const logger = options?.logger ?? true;
  const app = Fastify({
    logger,
    trustProxy: process.env.TRUST_PROXY === "1",
  });

  const jwtSecret = process.env.JWT_SECRET || "dev-secret";
  const throttleSecret = process.env.AUTH_THROTTLE_SECRET || jwtSecret;

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Key"],
  });

  await app.register(cookie, {
    secret: jwtSecret,
  });

  await app.register(jwt, {
    secret: jwtSecret,
  });

  await app.register(websocket);

  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  const users = new PostgresUserRepository();
  const requests = new PostgresRequestRepository();
  const clients = new PostgresClientRepository();
  const providers = new PostgresProviderRepository();
  const profiles = new PostgresProfileRepository();
  const providerSearch = new PostgresProviderSearchRepository();
  const openJobs = new PostgresOpenJobRepository();
  const geo = new PostgresGeoService();
  const cloudinary = createCloudinaryServiceOrNull();
  const passwordHasher = new BcryptPasswordHasher();
  const realtime = new RealtimeBroadcasterAdapter();
  const email = createEmailSender();
  const audit = new PostgresAuditLogRepository();
  const loginThrottle = new LoginThrottleService(new PostgresLoginThrottleRepository(), throttleSecret);
  const passwordResetTokens = new PostgresPasswordResetTokenStore();

  const ipRateLimit = {
    login: createIpRateLimiter({ windowMs: FIFTEEN_MIN, max: 30, routeKey: "auth-login" }),
    registerClient: createIpRateLimiter({ windowMs: FIFTEEN_MIN, max: 25, routeKey: "auth-register-client" }),
    registerProvider: createIpRateLimiter({ windowMs: FIFTEEN_MIN, max: 25, routeKey: "auth-register-provider" }),
    forgotPassword: createIpRateLimiter({ windowMs: FIFTEEN_MIN, max: 10, routeKey: "auth-forgot-password" }),
    resetPassword: createIpRateLimiter({ windowMs: FIFTEEN_MIN, max: 20, routeKey: "auth-reset-password" }),
  };

  registerAuthenticate(app);
  registerWebSocketRoute(app, requests);

  app.get("/", async () => ({
    name: "teu-faz-tudo-api",
    health: "/health",
    hint: "Esta é só a API REST. Em dev, abra o app em http://localhost:8080",
  }));

  app.get("/health", async () => ({ status: "ok" }));

  await registerLegalRoutes(app);

  await initDb();

  await registerAuthRoutes(app, {
    users,
    geo,
    passwordHasher,
    emailSender: email,
    passwordResetTokens,
    audit,
    loginThrottle,
    ipRateLimit,
    cloudinary,
  });
  await registerMeRoutes(app, {
    profiles,
    users,
    providers,
    geo,
    cloudinary,
    audit,
  });
  await registerClientRoutes(app, clients);
  await registerProviderRoutes(app, { providers, cloudinary, audit });
  await registerRequestRoutes(app, { users, requests, geo, realtime, email, audit });
  await registerProviderSearchRoutes(app, { providerSearch, geo });
  await registerOpenJobRoutes(app, { users, openJobs, geo, realtime });

  return app;
}
