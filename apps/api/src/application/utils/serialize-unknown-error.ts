/**
 * External SDKs sometimes return plain objects `{ message, http_code }` instead of `Error`;
 * `String(err)` becomes "[object Object]".
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
