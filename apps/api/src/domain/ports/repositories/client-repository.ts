export type ClientRequestForRatingRow = {
  id: string;
  client_id: string;
  provider_id: string | null;
  status: string;
};

export interface IClientRepository {
  listRequests(clientId: string): Promise<Record<string, unknown>[]>;
  listHistory(clientId: string): Promise<Record<string, unknown>[]>;
  findRequestForRating(requestId: string): Promise<ClientRequestForRatingRow | null>;
  hasRating(requestId: string): Promise<boolean>;
  insertRating(params: {
    id: string;
    requestId: string;
    clientId: string;
    providerId: string;
    rating: number;
    review: string | null;
    tags: string[];
    createdAt: string;
  }): Promise<void>;
}
