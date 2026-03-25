/** Loads municipality names for a UF from IBGE API. */
export async function fetchMunicipiosByUf(uf: string): Promise<string[]> {
  const res = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(uf)}/municipios`
  );
  if (!res.ok) throw new Error("Não foi possível carregar cidades");
  const data = (await res.json()) as { nome: string }[];
  return data.map((m) => m.nome).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Matches ViaCEP locality name to IBGE list (accent-insensitive). */
export function matchMunicipioName(ibgeNames: string[], viaCepLocalidade: string): string | undefined {
  const fold = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .trim();
  const target = fold(viaCepLocalidade);
  return ibgeNames.find((n) => fold(n) === target);
}
