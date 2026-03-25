export type ViaCepSuccess = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
};

/**
 * Consults ViaCEP (https://viacep.com.br/). Returns null if CEP is invalid or not found.
 */
export async function lookupViaCep(cepDigits: string): Promise<ViaCepSuccess | null> {
  if (cepDigits.length !== 8) return null;
  const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
  if (!response.ok) return null;
  const data = (await response.json()) as { erro?: boolean } & Partial<ViaCepSuccess>;
  if (data.erro === true) return null;
  if (!data.uf || !data.localidade) return null;
  return {
    cep: String(data.cep ?? ""),
    logradouro: String(data.logradouro ?? ""),
    complemento: String(data.complemento ?? ""),
    bairro: String(data.bairro ?? ""),
    localidade: String(data.localidade),
    uf: String(data.uf),
  };
}
