export type ViaCepResponse = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
};

export async function fetchViaCep(cepDigits: string): Promise<ViaCepResponse | null> {
  const clean = cepDigits.replace(/\D/g, "").slice(0, 8);
  if (clean.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  if (!res.ok) return null;
  const data = (await res.json()) as ViaCepResponse & { erro?: boolean };
  if (data.erro === true) return null;
  if (!data.uf || !data.localidade) return null;
  return data;
}
