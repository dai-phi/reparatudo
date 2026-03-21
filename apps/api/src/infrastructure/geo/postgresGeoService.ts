import type { Pool } from "pg";
import type { IGeoService, LatLng } from "../../domain/ports/geo-service.js";
import { pool as defaultPool } from "../persistence/pool.js";

export class PostgresGeoService implements IGeoService {
  constructor(private readonly db: Pool = defaultPool) {}

  normalizeCep(cep: string): string {
    return cep.replace(/\D/g, "").slice(0, 8);
  }

  isValidCep(cep: string): boolean {
    return this.normalizeCep(cep).length === 8;
  }

  distanceKm(a: LatLng, b: LatLng): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  async getCepCoords(rawCep: string): Promise<LatLng | null> {
    const cep = this.normalizeCep(rawCep);
    if (cep.length !== 8) return null;

    const cached = await this.db.query("SELECT lat, lng FROM cep_cache WHERE cep = $1", [cep]);
    if (cached.rowCount) {
      return { lat: Number(cached.rows[0].lat), lng: Number(cached.rows[0].lng) };
    }

    let coords = await fetchFromBrasilApi(cep);
    if (!coords) {
      coords = await fetchFromNominatim(cep);
    }

    if (!coords) return null;

    await this.db.query(
      `INSERT INTO cep_cache (cep, lat, lng, updated_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (cep)
       DO UPDATE SET lat = $2, lng = $3, updated_at = $4`,
      [cep, coords.lat, coords.lng, new Date().toISOString()]
    );

    return coords;
  }

  async getAddressCoords(addressString: string): Promise<LatLng | null> {
    const query = encodeURIComponent(`${addressString.trim()}, Brazil`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;
    const response = await fetch(url, {
      headers: { "User-Agent": "fixja-app/1.0" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const item = data?.[0];
    if (!item?.lat || !item?.lon) return null;
    return { lat: Number(item.lat), lng: Number(item.lon) };
  }
}

async function fetchFromBrasilApi(cep: string) {
  const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
  if (!response.ok) return null;
  const data = (await response.json()) as {
    location?: { coordinates?: { latitude?: number; longitude?: number } };
  };
  const coords = data?.location?.coordinates;
  if (!coords?.latitude || !coords?.longitude) return null;
  return { lat: Number(coords.latitude), lng: Number(coords.longitude) };
}

async function fetchFromNominatim(cep: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&postalcode=${cep}&country=Brazil&limit=1`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "fixja-app/1.0",
    },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const item = data?.[0];
  if (!item?.lat || !item?.lon) return null;
  return { lat: Number(item.lat), lng: Number(item.lon) };
}
