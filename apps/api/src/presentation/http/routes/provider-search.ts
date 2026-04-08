import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { IGeoService } from "../../../domain/ports/geo-service.js";
import { SERVICE_IDS } from "../../../domain/value-objects/service-id.js";
import type { IProviderSearchRepository } from "../../../domain/ports/repositories/provider-search-repository.js";

const SORT_VALUES = ["recommended", "distance", "rating", "response_time"] as const;
type ProviderSearchSort = (typeof SORT_VALUES)[number];

const querySchema = z.object({
  serviceId: z.enum(SERVICE_IDS),
  sort: z.enum(SORT_VALUES).default("recommended"),
  verifiedOnly: z
    .union([z.literal("true"), z.literal("false"), z.boolean(), z.undefined()])
    .optional()
    .transform((v) => v === true || v === "true"),
  minRating: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.coerce.number().min(0).max(5).optional()
  ),
});

export type ProviderSearchRoutesDeps = {
  providerSearch: IProviderSearchRepository;
  geo: IGeoService;
};

type ClientCoords = { lat: number; lng: number };

type ProviderRow = {
  id: string;
  name: string;
  photo_url: string | null;
  rating_avg: unknown;
  avg_response: unknown;
  work_lat: unknown;
  work_lng: unknown;
  last_service_lat: unknown;
  last_service_lng: unknown;
  last_service_at: string | null;
  radius_km: unknown;
  verification_status: string | null;
};

type MappedProvider = {
  id: string;
  name: string;
  photoUrl: string | null;
  rating: number;
  avgResponseMins: number;
  distanceKm: number | null;
  lastServiceDistanceKm: number | null;
  lastServiceAt: string | null;
  radiusKm: number;
  verificationStatus: "pending" | "verified" | "rejected" | "unverified";
  isVerified: boolean;
};

/** Higher is better; 0-100 with one decimal, for ranking and optional UI. */
function computeProviderMatchScore(input: {
  distanceKm: number;
  radiusKm: number;
  rating: number;
  isVerified: boolean;
  avgResponseMins: number;
}): number {
  const radius = Math.max(Number(input.radiusKm) || 0, 0.001);
  const proximity = Math.max(0, Math.min(1, 1 - input.distanceKm / radius));
  const ratingN = Math.max(0, Math.min(1, input.rating / 5));
  const verifiedN = input.isVerified ? 1 : 0;
  let responseN = 0;
  if (input.avgResponseMins < 9999) {
    responseN = Math.max(0, 1 - Math.min(input.avgResponseMins / 300, 1));
  }
  const raw = 0.35 * proximity + 0.28 * ratingN + 0.12 * verifiedN + 0.25 * responseN;
  return Math.round(raw * 1000) / 10;
}

function mapRowToProvider(row: ProviderRow, clientCoords: ClientCoords, geo: IGeoService): MappedProvider {
  const distance =
    row.work_lat && row.work_lng
      ? geo.distanceKm(clientCoords, { lat: Number(row.work_lat), lng: Number(row.work_lng) })
      : null;
  const lastServiceKm =
    row.last_service_lat != null && row.last_service_lng != null
      ? geo.distanceKm(clientCoords, { lat: Number(row.last_service_lat), lng: Number(row.last_service_lng) })
      : null;
  const verificationStatus =
    row.verification_status === "pending" ||
    row.verification_status === "verified" ||
    row.verification_status === "rejected"
      ? row.verification_status
      : "unverified";
  const isVerified = row.verification_status === "verified";

  const out: MappedProvider = {
    id: row.id,
    name: row.name,
    photoUrl: row.photo_url || null,
    rating: Number(row.rating_avg || 0),
    avgResponseMins: Math.round(Number(row.avg_response || 0)),
    distanceKm: distance !== null ? Number(distance.toFixed(1)) : null,
    lastServiceDistanceKm: lastServiceKm !== null ? Number(lastServiceKm.toFixed(1)) : null,
    lastServiceAt: row.last_service_at || null,
    radiusKm: row.radius_km ? Number(row.radius_km) : 0,
    verificationStatus,
    isVerified,
  };
  return out;
}

type ScoredProvider = MappedProvider & { matchScore: number };

function sortProviders(items: ScoredProvider[], sort: ProviderSearchSort): ScoredProvider[] {
  const copy = [...items];
  switch (sort) {
    case "distance":
      copy.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      break;
    case "rating":
      copy.sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      });
      break;
    case "response_time":
      copy.sort((a, b) => {
        const ae = a.avgResponseMins >= 9999 ? Number.POSITIVE_INFINITY : a.avgResponseMins;
        const be = b.avgResponseMins >= 9999 ? Number.POSITIVE_INFINITY : b.avgResponseMins;
        if (ae !== be) return ae - be;
        return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      });
      break;
    case "recommended":
    default:
      copy.sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      });
      break;
  }
  return copy;
}

export async function registerProviderSearchRoutes(app: FastifyInstance, deps: ProviderSearchRoutesDeps) {
  const { providerSearch: providers, geo } = deps;
  app.get("/providers", { preHandler: [app.authenticate] }, async (request, reply) => {
    if (request.user.role !== "client") {
      return reply.code(403).send({ message: "Acesso negado" });
    }

    const parsed = querySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Parametros invalidos", issues: parsed.error.flatten() });
    }

    const { serviceId, sort, verifiedOnly, minRating } = parsed.data;

    const client = await providers.findClientCoords(request.user.sub);

    if (!client?.cep_lat || !client?.cep_lng) {
      return reply.code(400).send({ message: "CEP do cliente nao cadastrado" });
    }

    const providerResult = await providers.listProvidersByService(serviceId);

    const clientCoords = { lat: Number(client.cep_lat), lng: Number(client.cep_lng) };

    const mapped = providerResult
      .map((row) => mapRowToProvider(row as unknown as ProviderRow, clientCoords, geo))
      .filter((provider) => {
        if (provider.distanceKm === null) return false;
        if (!provider.radiusKm) return false;
        return provider.distanceKm <= provider.radiusKm;
      })
      .filter((p) => !verifiedOnly || p.isVerified)
      .filter((p) => minRating === undefined || p.rating >= minRating);

    const withScores = mapped.map((p) => ({
      ...p,
      matchScore: computeProviderMatchScore({
        distanceKm: p.distanceKm!,
        radiusKm: p.radiusKm,
        rating: p.rating,
        isVerified: p.isVerified,
        avgResponseMins: p.avgResponseMins,
      }),
    }));

    const sorted = sortProviders(withScores, sort);

    return reply.send(sorted);
  });
}
