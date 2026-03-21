import "@fastify/jwt";
import type { Role } from "./domain/entities/role.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      role: Role;
    };
    user: {
      sub: string;
      role: Role;
    };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: unknown, reply: unknown) => Promise<void>;
  }
}
