import type { ServiceId } from "./service-id.js";
import { SERVICE_IDS } from "./service-id.js";

/** Stable snake_case ids; unique per service family. Matching does not filter by subtype yet. */
export type ServiceSubtypeDef = {
  id: string;
  labelPt: string;
  /** When set, UI may group options (e.g. "Outros" for reparos). */
  groupPt?: string;
};

export const SERVICE_SUBTYPE_CATALOG: Record<ServiceId, ServiceSubtypeDef[]> = {
  eletrica: [
    { id: "outlet_installation", labelPt: "Instalação de tomadas" },
    { id: "lighting_repair", labelPt: "Iluminação / luminárias" },
    { id: "circuit_breaker_replacement", labelPt: "Troca de disjuntor" },
    { id: "wiring_repair", labelPt: "Reparo de fiação" },
    { id: "other", labelPt: "Outro (elétrica)" },
  ],
  hidraulica: [
    { id: "leak_repair", labelPt: "Vazamento" },
    { id: "clog_removal", labelPt: "Desentupimento" },
    { id: "fixture_installation", labelPt: "Instalação de torneira / vaso" },
    { id: "water_heater", labelPt: "Aquecedor / torneira elétrica" },
    { id: "other", labelPt: "Outro (hidráulica)" },
  ],
  pintura: [
    { id: "interior_walls", labelPt: "Pintura interna" },
    { id: "exterior_facade", labelPt: "Fachada / externa" },
    { id: "touch_up", labelPt: "Retoques / manutenção" },
    { id: "other", labelPt: "Outro (pintura)" },
  ],
  montagem: [
    { id: "furniture", labelPt: "Montagem de móveis" },
    { id: "shelves_tv", labelPt: "Prateleiras / suporte de TV" },
    { id: "doors_windows", labelPt: "Portas e janelas" },
    { id: "other", labelPt: "Outro (montagem)" },
  ],
  reparos: [
    { id: "chaveiro", labelPt: "Chaveiro" },
    { id: "detetizador", labelPt: "Detetizador" },
    { id: "desentupidor", labelPt: "Desentupidor" },
    { id: "desinfecao", labelPt: "Desinfecção" },
    { id: "marceneiro", labelPt: "Marceneiro" },
    { id: "mudancas_carretos", labelPt: "Mudanças e carretos" },
    { id: "vidraceiro", labelPt: "Vidraceiro" },
    { id: "jardineiro", labelPt: "Jardineiro" },
    { id: "pedreiro", labelPt: "Pedreiro" },
    { id: "eletrodomestico", labelPt: "Eletrodoméstico" },
    { id: "outros_door_lock_hinge", labelPt: "Portas, fechaduras e dobradiças", groupPt: "Outros" },
    { id: "outros_drywall_patch", labelPt: "Drywall / pequenos buracos", groupPt: "Outros" },
    { id: "outros_silicone_sealing", labelPt: "Silicone / vedação", groupPt: "Outros" },
    { id: "outros_tile_grout", labelPt: "Azulejo / rejunte", groupPt: "Outros" },
    { id: "outros_appliance_install", labelPt: "Instalação de eletrodomésticos", groupPt: "Outros" },
    { id: "outros_small_carpentry", labelPt: "Pequenos reparos em madeira", groupPt: "Outros" },
    { id: "outros_general_handyman", labelPt: "Pequenos reparos gerais", groupPt: "Outros" },
    { id: "outros_other", labelPt: "Outro / diversos", groupPt: "Outros" },
  ],
};

/** Pre–outros_* ids still stored in DB; labels for read-only display. */
const LEGACY_REPAROS_SUBTYPE_LABELS: Record<string, string> = {
  door_lock_hinge: "Portas, fechaduras e dobradiças",
  drywall_patch: "Drywall / pequenos buracos",
  silicone_sealing: "Silicone / vedação",
  tile_grout: "Azulejo / rejunte",
  appliance_install: "Instalação de eletrodomésticos",
  small_carpentry: "Pequenos reparos em madeira",
  general_handyman: "Pequenos reparos gerais",
  other: "Outro (reparos)",
};

const allowedByService = new Map<ServiceId, Set<string>>(
  SERVICE_IDS.map((id) => [id, new Set(SERVICE_SUBTYPE_CATALOG[id].map((s) => s.id))])
);

export function isValidServiceSubtype(serviceId: ServiceId, subtype: string | null | undefined): boolean {
  const st = normalizeServiceSubtype(subtype);
  if (st == null) return false;
  return allowedByService.get(serviceId)?.has(st) ?? false;
}

export function normalizeServiceSubtype(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t === "" ? null : t;
}

export function getServiceSubtypeLabelPt(serviceId: ServiceId, subtypeId: string | null | undefined): string | null {
  if (!subtypeId) return null;
  const hit = SERVICE_SUBTYPE_CATALOG[serviceId].find((s) => s.id === subtypeId);
  if (hit) return hit.labelPt;
  if (serviceId === "reparos" && LEGACY_REPAROS_SUBTYPE_LABELS[subtypeId]) {
    return LEGACY_REPAROS_SUBTYPE_LABELS[subtypeId];
  }
  return null;
}
