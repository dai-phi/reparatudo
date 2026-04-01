import { ProviderPlanId, ProviderPlanPaymentMethod } from "../../value-objects/provider-plan.js";

export interface IProviderRepository {
  listActiveRequests(providerId: string): Promise<Record<string, unknown>[]>;
  getCompletedStats(providerId: string): Promise<{
    completed: Record<string, unknown>;
    rating: Record<string, unknown>;
  }>;
  listHistory(providerId: string): Promise<Record<string, unknown>[]>;
  refreshExpiredPlanSubscriptions(providerId: string, currentAt: string): Promise<void>;
  listPlans(): Promise<Record<string, unknown>[]>;
  findPlanById(planId: ProviderPlanId): Promise<Record<string, unknown> | null>;
  findCurrentPlanSubscription(providerId: string): Promise<Record<string, unknown> | null>;
  listPlanPayments(providerId: string): Promise<Record<string, unknown>[]>;
  purchasePlan(input: {
    providerId: string;
    planId: ProviderPlanId;
    paymentMethod: ProviderPlanPaymentMethod;
    cardLastFour: string | null;
    pixCopyPaste: string | null;
    mockTransactionId: string;
    currentAt: string;
  }): Promise<{ subscription: Record<string, unknown>; payment: Record<string, unknown> }>;
  findVerificationByProviderId(providerId: string): Promise<Record<string, unknown> | null>;
  updateVerificationAssets(
    providerId: string,
    updates: {
      verificationDocumentUrl?: string | null;
      verificationDocumentStorageKey?: string | null;
      verificationSelfieUrl?: string | null;
      verificationSelfieStorageKey?: string | null;
      verificationStatus?: "unverified" | "pending" | "verified" | "rejected";
    }
  ): Promise<void>;
  listVerificationQueue(status?: "pending" | "unverified" | "verified" | "rejected"): Promise<Record<string, unknown>[]>;
  findRatingForProviderResponse(providerId: string, ratingId: string): Promise<Record<string, unknown> | null>;
  updateRatingProviderResponse(params: { ratingId: string; response: string; now: string }): Promise<void>;
}
