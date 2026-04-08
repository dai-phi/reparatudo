import type { LucideIcon } from "lucide-react";
import { Zap, Droplets, PaintBucket, Hammer, Wrench } from "lucide-react";

const ICON_BY_SERVICE_ID: Record<string, LucideIcon> = {
  eletrica: Zap,
  hidraulica: Droplets,
  pintura: PaintBucket,
  montagem: Hammer,
  reparos: Wrench,
};

export function getServiceTypeIcon(serviceId: string): LucideIcon {
  return ICON_BY_SERVICE_ID[serviceId] ?? Wrench;
}
