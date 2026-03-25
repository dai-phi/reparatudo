/**
 * Cloudinary e outros SDKs devolvem por vezes objetos plain `{ message, http_code }`
 * em vez de `Error`; `String(err)` vira "[object Object]".
 */
export function serializeUnknownError(err: unknown): string {
  if (err == null) {
    return "Erro desconhecido";
  }
  if (typeof err === "string") {
    return err;
  }
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.length > 0) {
      return o.message;
    }
    if (o.error != null && typeof o.error === "object") {
      const inner = o.error as Record<string, unknown>;
      if (typeof inner.message === "string" && inner.message.length > 0) {
        return inner.message;
      }
    }
    try {
      return JSON.stringify(o);
    } catch {
      return Object.prototype.toString.call(err);
    }
  }
  return String(err);
}

export function getHttpStatusFromError(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const o = err as Record<string, unknown>;
  const direct = o.http_code ?? o.statusCode;
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return direct;
  }
  if (typeof direct === "string") {
    const n = Number(direct);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
