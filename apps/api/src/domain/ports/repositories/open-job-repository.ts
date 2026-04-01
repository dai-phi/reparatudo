import { ServiceId } from "../../value-objects/service-id.js";

export type OpenJobStatus = "open" | "awarded" | "cancelled";

export type OpenJobRecord = {
  id: string;
  clientId: string;
  serviceId: ServiceId;
  description: string | null;
  status: OpenJobStatus;
  locationLat: number | null;
  locationLng: number | null;
  createdAt: string;
  updatedAt: string;
};

export type QuoteStatus = "pending" | "accepted" | "rejected";

export type QuoteRecord = {
  id: string;
  openJobId: string;
  providerId: string;
  amount: number;
  etaDays: number | null;
  message: string | null;
  conditions: string | null;
  status: QuoteStatus;
  createdAt: string;
  updatedAt: string;
};

export type OpenJobDiscoverRow = OpenJobRecord & {
  clientLat: number;
  clientLng: number;
  clientName: string;
};

export type QuoteWithProvider = QuoteRecord & {
  providerName: string;
  providerPhotoUrl: string | null;
  providerVerified: boolean;
};

export interface IOpenJobRepository {
  insertOpenJob(params: {
    id: string;
    clientId: string;
    serviceId: ServiceId;
    description: string | null;
    status: OpenJobStatus;
    locationLat: number | null;
    locationLng: number | null;
    createdAt: string;
    updatedAt: string;
  }): Promise<void>;

  findById(id: string): Promise<OpenJobRecord | null>;

  findRequestIdByOpenJobId(openJobId: string): Promise<string | null>;

  listForClient(clientId: string): Promise<OpenJobRecord[]>;

  listDiscoverableForProvider(providerId: string): Promise<OpenJobDiscoverRow[]>;

  updateJobStatus(params: { id: string; status: OpenJobStatus; updatedAt: string }): Promise<void>;

  insertQuote(params: {
    id: string;
    openJobId: string;
    providerId: string;
    amount: number;
    etaDays: number | null;
    message: string | null;
    conditions: string | null;
    status: QuoteStatus;
    createdAt: string;
    updatedAt: string;
  }): Promise<void>;

  findQuoteById(id: string): Promise<QuoteRecord | null>;

  listQuotesWithProviders(openJobId: string): Promise<QuoteWithProvider[]>;

  hasQuoteFromProvider(openJobId: string, providerId: string): Promise<boolean>;

  rejectPendingQuotesExcept(params: { openJobId: string; exceptQuoteId: string; updatedAt: string }): Promise<void>;

  rejectAllPendingForOpenJob(openJobId: string, updatedAt: string): Promise<void>;

  updateQuoteStatus(params: { id: string; status: QuoteStatus; updatedAt: string }): Promise<void>;

  /**
   * Updates quotes, open job, inserts request + system message in one transaction.
   */
  acceptQuoteAndCreateRequest(params: {
    quoteId: string;
    openJobId: string;
    requestId: string;
    clientId: string;
    providerId: string;
    serviceId: ServiceId;
    description: string | null;
    agreedValue: number;
    locationLat: number | null;
    locationLng: number | null;
    now: string;
    systemMessageId: string;
    systemMessageText: string;
  }): Promise<void>;
}
