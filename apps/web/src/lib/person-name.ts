/** At least two name parts (e.g. "Luis Silva"). */
export function hasFullName(name: string): boolean {
  return name.trim().split(/\s+/).filter(Boolean).length >= 2;
}
