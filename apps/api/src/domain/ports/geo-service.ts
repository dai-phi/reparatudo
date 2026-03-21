export type LatLng = { lat: number; lng: number };

export interface IGeoService {
  normalizeCep(cep: string): string;
  isValidCep(cep: string): boolean;
  distanceKm(a: LatLng, b: LatLng): number;
  getCepCoords(rawCep: string): Promise<LatLng | null>;
  getAddressCoords(addressString: string): Promise<LatLng | null>;
}
