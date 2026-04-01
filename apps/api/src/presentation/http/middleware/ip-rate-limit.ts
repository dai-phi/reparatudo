import type { FastifyReply, FastifyRequest } from "fastify";

type Bucket = { windowStart: number; count: number };

export function createIpRateLimiter(options: { windowMs: number; max: number; routeKey: string }) {
  const buckets = new Map<string, Bucket>();

  return async function ipRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const ip = request.ip || "unknown";
    const key = `${ip}:${options.routeKey}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now - b.windowStart >= options.windowMs) {
      b = { windowStart: now, count: 0 };
      buckets.set(key, b);
    }
    b.count += 1;
    if (b.count > options.max) {
      reply.code(429).send({ message: "Muitas requisições deste endereço. Tente novamente mais tarde." });
      return;
    }
  };
}
