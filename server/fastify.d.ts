import "@fastify/jwt";
import type { Role } from "./db.js";

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
