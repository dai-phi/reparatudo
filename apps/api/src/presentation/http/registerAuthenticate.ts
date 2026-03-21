import type { FastifyInstance } from "fastify";

export function registerAuthenticate(app: FastifyInstance) {
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
}
