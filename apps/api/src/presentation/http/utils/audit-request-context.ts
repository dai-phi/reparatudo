import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";

export function hashIpForAudit(ip: string | undefined, secret: string): string | null {
  if (!ip || ip === "unknown") return null;
  const h = createHash("sha256").update(`${secret}|${ip}`).digest("hex");
  return h.slice(0, 16);
}

export function userAgentSnippet(request: FastifyRequest): string | null {
  const ua = request.headers["user-agent"];
  if (typeof ua !== "string" || !ua.trim()) return null;
  return ua.trim().slice(0, 256);
}
