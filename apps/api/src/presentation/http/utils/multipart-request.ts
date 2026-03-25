import type { FastifyRequest } from "fastify";

/** Verifica o header (nao depende do flag interno do @fastify/multipart). */
export function requestLooksMultipart(request: FastifyRequest): boolean {
  const ct = request.headers["content-type"];
  if (typeof ct !== "string") return false;
  return ct.toLowerCase().trimStart().startsWith("multipart/form-data");
}

export function getMultipartParseErrorStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "statusCode" in err) {
    const n = Number((err as { statusCode: number }).statusCode);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
