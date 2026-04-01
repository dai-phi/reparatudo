export { serializeUnknownError } from "../../../application/utils/serialize-unknown-error.js";

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
