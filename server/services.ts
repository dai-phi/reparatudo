export const SERVICE_IDS = ["eletrica", "hidraulica", "pintura", "montagem", "reparos"] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];

export const SERVICE_LABELS: Record<ServiceId, string> = {
  eletrica: "Elétrica",
  hidraulica: "Hidráulica",
  pintura: "Pintura",
  montagem: "Montagem",
  reparos: "Reparos Gerais",
};

export const SERVICE_SET = new Set<string>(SERVICE_IDS);

export function isServiceId(value: string): value is ServiceId {
  return SERVICE_SET.has(value);
}
