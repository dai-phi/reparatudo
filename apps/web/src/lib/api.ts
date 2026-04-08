import { queryClient } from "./queryClient";

export type Role = "client" | "provider";
export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export type ProviderPlanId = "standard" | "pro";

export interface ProviderCurrentPlanSummary {
  id: ProviderPlanId;
  code: string;
  name: string;
  status: "active" | "expired" | "cancelled";
  expiresAt: string;
  expiresAtLabel: string;
}

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone: string;
  cep?: string;
  workCep?: string;
  workAddress?: string;
  photoUrl?: string | null;
  verificationStatus?: VerificationStatus;
  verificationDocumentUrl?: string | null;
  verificationSelfieUrl?: string | null;
  address?: string;
  cpf?: string;
  radiusKm?: number;
  services?: string[];
  currentPlan?: ProviderCurrentPlanSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ServiceCatalogSubtype {
  id: string;
  labelPt: string;
  groupPt?: string;
}

export interface ServiceCatalogEntry {
  id: string;
  labelPt: string;
  subtypes: ServiceCatalogSubtype[];
}

export interface ServiceCatalogResponse {
  services: ServiceCatalogEntry[];
}

export interface RequestSummary {
  id: string;
  client: string;
  service: string;
  serviceSubtype?: string | null;
  serviceSubtypeLabel?: string | null;
  desc: string;
  distance: string;
  time: string;
  status?: string;
  statusLabel?: string;
  value?: string;
  pendingStepLabel?: string | null;
  providerConfirmed?: boolean;
  clientConfirmed?: boolean;
}

export interface ProviderStats {
  attendedCount: number;
  ratingAvg: number;
  monthEarnings: number;
  monthEarningsLabel: string;
  avgResponseMins: number;
}

export interface ProviderHistoryItem {
  id: string;
  client: string;
  service: string;
  serviceSubtype?: string | null;
  serviceSubtypeLabel?: string | null;
  desc: string;
  date: string;
  value: string;
  ratingId?: string | null;
  rating?: number;
  review?: string;
  tags?: string[];
  providerResponse?: string;
}

export type ProviderPlanPaymentMethod = "pix" | "credit_card" | "debit_card";

export type ProviderPlanPaymentStatus = "pending" | "paid" | "failed" | "cancelled";

export interface ProviderPlanOption {
  id: ProviderPlanId;
  code: string;
  name: string;
  description: string;
  price: number;
  priceLabel: string;
  billingCycleDays: number;
  features: string[];
  isCurrent: boolean;
}

export interface ProviderCurrentSubscription {
  id: string;
  providerId: string;
  planId: ProviderPlanId;
  planCode: string;
  planName: string;
  planDescription: string;
  status: "active" | "expired" | "cancelled";
  startsAt: string;
  startsAtLabel: string;
  expiresAt: string;
  expiresAtLabel: string;
  daysRemaining: number;
  price: number;
  priceLabel: string;
  billingCycleDays: number;
  features: string[];
}

export interface ProviderPlansResponse {
  plans: ProviderPlanOption[];
  currentSubscription: ProviderCurrentSubscription | null;
}

export interface ProviderPlanPaymentRow {
  id: string;
  providerId: string;
  planId: ProviderPlanId;
  planCode: string;
  planName: string;
  subscriptionId: string;
  amount: number;
  amountLabel: string;
  currency: string;
  paymentMethod: ProviderPlanPaymentMethod;
  status: ProviderPlanPaymentStatus;
  coverageStartsAt: string;
  coverageStartsAtLabel: string;
  coverageEndsAt: string;
  coverageEndsAtLabel: string;
  paidAt: string | null;
  paidAtLabel: string | null;
  pixCopyPaste: string | null;
  cardLastFour: string | null;
  mockTransactionId: string;
  createdAt: string;
}

export interface ProviderPlanPurchaseResponse {
  currentSubscription: ProviderCurrentSubscription | null;
  payment: ProviderPlanPaymentRow | null;
}

export interface ClientHistoryItem {
  id: string;
  provider: string;
  service: string;
  serviceSubtype?: string | null;
  serviceSubtypeLabel?: string | null;
  desc: string;
  date: string;
  value: string;
  rated: boolean;
  rating: number;
  review: string;
  tags?: string[];
  providerResponse?: string;
}

export interface ClientRequestItem {
  id: string;
  provider: string;
  service: string;
  serviceSubtype?: string | null;
  serviceSubtypeLabel?: string | null;
  desc: string;
  status: string;
  statusLabel: string;
  chatOpen: boolean;
  time: string;
}

export interface ClientOpenJobListItem {
  id: string;
  serviceId: string;
  serviceLabel: string;
  serviceSubtype?: string | null;
  serviceSubtypeLabel?: string | null;
  description: string;
  status: "open" | "awarded" | "cancelled";
  quoteCount: number;
  createdAt: string;
}

export interface OpenJobQuoteClientView {
  id: string;
  providerId: string;
  providerName: string;
  providerPhotoUrl: string | null;
  providerVerified: boolean;
  amount: number;
  amountLabel: string;
  etaDays: number | null;
  message: string | null;
  conditions: string | null;
  status: string;
  createdAt: string;
}

export interface OpenJobQuoteProviderView {
  id: string;
  amount: number;
  amountLabel: string;
  etaDays: number | null;
  message: string | null;
  conditions: string | null;
  status: string;
  createdAt: string;
}

export interface OpenJobDetailClient {
  id: string;
  serviceId: string;
  serviceLabel: string;
  serviceSubtype?: string | null;
  serviceSubtypeLabel?: string | null;
  description: string;
  status: "open" | "awarded" | "cancelled";
  locationLat: number | null;
  locationLng: number | null;
  createdAt: string;
  resultRequestId: string | null;
  quotes: OpenJobQuoteClientView[];
}

export interface OpenJobDetailProvider {
  id: string;
  serviceId: string;
  serviceLabel: string;
  serviceSubtype?: string | null;
  serviceSubtypeLabel?: string | null;
  description: string;
  status: "open" | "awarded" | "cancelled";
  locationLat: number | null;
  locationLng: number | null;
  createdAt: string;
  resultRequestId: string | null;
  quotes: OpenJobQuoteProviderView[];
}

export interface ProviderOpenJobDiscoverItem {
  id: string;
  serviceId: string;
  serviceLabel: string;
  serviceSubtype?: string | null;
  serviceSubtypeLabel?: string | null;
  description: string;
  clientName: string;
  distanceKm: number;
  createdAt: string;
  timeLabel: string;
}

export interface RequestDetails {
  id: string;
  status: string;
  serviceId: string;
  serviceLabel: string;
  serviceSubtype?: string | null;
  serviceSubtypeLabel?: string | null;
  description: string;
  agreedValue: number;
  agreedValueLabel: string;
  clientConfirmed?: boolean;
  providerConfirmed?: boolean;
  provider: null | { id: string; name: string; phone?: string; photoUrl?: string | null; rating: number; distanceKm: number };
  client: null | { id: string; name: string };
}

export interface ChatMessage {
  id: string;
  from: "client" | "provider" | "system";
  text: string;
  time: string;
}

export type ProviderSearchSort = "recommended" | "distance" | "rating" | "response_time";

export interface ProviderCard {
  id: string;
  name: string;
  photoUrl: string | null;
  rating: number;
  avgResponseMins: number;
  distanceKm: number | null;
  lastServiceDistanceKm: number | null;
  lastServiceAt: string | null;
  radiusKm: number;
  verificationStatus?: VerificationStatus;
  isVerified?: boolean;
  /** Combined match score (0–100), when returned by search; higher is better. */
  matchScore?: number;
}

export interface ProviderVerification {
  status: VerificationStatus;
  documentUrl: string | null;
  selfieUrl: string | null;
  canSubmit: boolean;
  isVerified: boolean;
}

export interface AdminProviderVerificationRow {
  providerId: string;
  name: string;
  email: string;
  phone: string;
  cpf: string | null;
  status: VerificationStatus;
  documentUrl: string | null;
  selfieUrl: string | null;
  updatedAt: string;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Works even when multiple bundles duplicate the ApiError class (instanceof would fail). */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

const TOKEN_KEY = "fixja_token";
const USER_KEY = "fixja_user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function setAuth(auth: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, auth.token);
  setStoredUser(auth.user);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function logout() {
  try {
    await fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include" });
  } finally {
    clearAuth();
    queryClient.clear();
  }
}

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3333").replace(/\/$/, "");

async function apiFetch<T>(path: string, options?: { method?: string; body?: unknown; auth?: boolean }) {
  const method = options?.method ?? "GET";
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (options?.auth) {
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: "include",
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (response.status === 401) {
      clearAuth();
    }
    const message = payload?.message || response.statusText || "Erro inesperado";
    throw new ApiError(message, response.status, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export type LegalSection = { heading: string; body: string };

export type LegalDocument = {
  slug: string;
  title: string;
  version: string;
  updatedAt: string;
  sections: LegalSection[];
};

export function fetchLegalDocument(slug: "terms" | "privacy" | "retention") {
  return apiFetch<LegalDocument>(`/legal/${slug}`);
}

export function fetchServiceCatalog() {
  return apiFetch<ServiceCatalogResponse>("/catalog/services");
}

export function registerClient(payload: {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  address: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep: string;
  password: string;
  passwordConfirm: string;
}) {
  return apiFetch<AuthResponse>("/auth/register/client", {
    method: "POST",
    body: payload,
  });
}

export async function registerProvider(payload: {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  radiusKm: number;
  services: string[];
  workAddress: string;
  workComplement?: string;
  workNeighborhood?: string;
  workCity?: string;
  workState?: string;
  workCep: string;
  password: string;
  passwordConfirm: string;
  /** Opcional: envia multipart para gravar foto no Cloudinary no cadastro. */
  profilePhoto?: File | null;
}): Promise<AuthResponse> {
  if (payload.profilePhoto) {
    const { profilePhoto, ...rest } = payload;
    const fd = new FormData();
    fd.append("name", rest.name);
    fd.append("email", rest.email);
    fd.append("phone", rest.phone);
    fd.append("cpf", rest.cpf);
    fd.append("radiusKm", String(rest.radiusKm));
    fd.append("services", JSON.stringify(rest.services));
    fd.append("workAddress", rest.workAddress);
    if (rest.workComplement) fd.append("workComplement", rest.workComplement);
    if (rest.workNeighborhood) fd.append("workNeighborhood", rest.workNeighborhood);
    fd.append("workCity", rest.workCity ?? "");
    fd.append("workState", rest.workState ?? "");
    fd.append("workCep", rest.workCep);
    fd.append("password", rest.password);
    fd.append("passwordConfirm", rest.passwordConfirm);
    fd.append("profilePhoto", profilePhoto);

    const response = await fetch(`${API_URL}/auth/register/provider`, {
      method: "POST",
      headers: { Accept: "application/json" },
      credentials: "include",
      body: fd,
    });

    if (!response.ok) {
      let errPayload: unknown = null;
      try {
        errPayload = await response.json();
      } catch {
        errPayload = null;
      }
      const message =
        typeof errPayload === "object" && errPayload !== null && "message" in errPayload
          ? String((errPayload as { message: unknown }).message)
          : response.statusText || "Erro inesperado";
      throw new ApiError(message, response.status, errPayload);
    }

    return (await response.json()) as AuthResponse;
  }

  return apiFetch<AuthResponse>("/auth/register/provider", {
    method: "POST",
    body: payload,
  });
}

export function login(payload: { email: string; password: string }) {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: payload,
  });
}

export function requestPasswordReset(payload: { email: string }) {
  return apiFetch<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: payload,
  });
}

export function resetPasswordWithToken(payload: {
  token: string;
  password: string;
  passwordConfirm: string;
}) {
  return apiFetch<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: payload,
  });
}

export function getMe() {
  return apiFetch<User>("/me", { auth: true });
}

export function updateMe(payload: {
  name?: string;
  phone?: string;
  address?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  radiusKm?: number;
  cep?: string;
  workAddress?: string;
  workComplement?: string;
  workNeighborhood?: string;
  workCity?: string;
  workState?: string;
  workCep?: string;
  photoUrl?: string;
}) {
  return apiFetch<User>("/me", { method: "PATCH", auth: true, body: payload });
}

export async function uploadMyProfilePhoto(file: File): Promise<User> {
  const token = getToken();
  const form = new FormData();
  form.append("photo", file);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}/me/photo`, {
    method: "POST",
    headers,
    credentials: "include",
    body: form,
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (response.status === 401) {
      clearAuth();
    }
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message: unknown }).message)
        : response.statusText || "Erro inesperado";
    throw new ApiError(message, response.status, payload);
  }

  return (await response.json()) as User;
}

export function deleteMyProfilePhoto(): Promise<User> {
  return apiFetch<User>("/me/photo", { method: "DELETE", auth: true });
}

export function getClientHistory() {
  return apiFetch<ClientHistoryItem[]>("/client/history", { auth: true });
}

export function getClientRequests() {
  return apiFetch<ClientRequestItem[]>("/client/requests", { auth: true });
}

export function createRating(payload: { requestId: string; rating: number; review?: string; tags?: string[] }) {
  return apiFetch<{ ok: true }>("/client/ratings", { method: "POST", auth: true, body: payload });
}

export function getProviderRequests() {
  return apiFetch<RequestSummary[]>("/provider/requests", { auth: true });
}

export function getProviderStats() {
  return apiFetch<ProviderStats>("/provider/stats", { auth: true });
}

export function getProviderHistory() {
  return apiFetch<ProviderHistoryItem[]>("/provider/history", { auth: true });
}

export function getProviderPlans() {
  return apiFetch<ProviderPlansResponse>("/provider/plans", { auth: true });
}

export function getProviderPlanPayments() {
  return apiFetch<ProviderPlanPaymentRow[]>("/provider/plans/payments", { auth: true });
}

export function purchaseProviderPlan(payload: {
  planId: ProviderPlanId;
  paymentMethod: ProviderPlanPaymentMethod;
  cardLastFour?: string;
}) {
  return apiFetch<ProviderPlanPurchaseResponse>("/provider/plans/subscribe", {
    method: "POST",
    auth: true,
    body: payload,
  });
}

export function getProviderVerification() {
  return apiFetch<ProviderVerification>("/provider/verification", { auth: true });
}

export async function uploadProviderVerificationDocument(file: File): Promise<{ documentUrl: string; status: VerificationStatus }> {
  const token = getToken();
  const form = new FormData();
  form.append("document", file);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}/provider/verification/document`, {
    method: "POST",
    headers,
    credentials: "include",
    body: form,
  });
  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (response.status === 401) clearAuth();
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message: unknown }).message)
        : response.statusText || "Erro inesperado";
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as { documentUrl: string; status: VerificationStatus };
}

export async function uploadProviderVerificationSelfie(file: File): Promise<{ selfieUrl: string; status: VerificationStatus }> {
  const token = getToken();
  const form = new FormData();
  form.append("selfie", file);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}/provider/verification/selfie`, {
    method: "POST",
    headers,
    credentials: "include",
    body: form,
  });
  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (response.status === 401) clearAuth();
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message: unknown }).message)
        : response.statusText || "Erro inesperado";
    throw new ApiError(message, response.status, payload);
  }
  return (await response.json()) as { selfieUrl: string; status: VerificationStatus };
}

export function submitProviderVerification() {
  return apiFetch<{ status: "pending"; message: string }>("/provider/verification/submit", { method: "POST", auth: true });
}

async function adminKycFetch<T>(path: string, adminKey: string, options?: { method?: string; body?: unknown }) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-admin-key": adminKey,
  };

  if (options?.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options?.method ?? "GET",
    headers,
    credentials: "include",
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? String((payload as { message: unknown }).message)
        : response.statusText || "Erro inesperado";
    throw new ApiError(message, response.status, payload);
  }

  return (await response.json()) as T;
}

export function getAdminProviderVerifications(
  adminKey: string,
  status: VerificationStatus = "pending"
) {
  const q = encodeURIComponent(status);
  return adminKycFetch<AdminProviderVerificationRow[]>(`/admin/provider-verifications?status=${q}`, adminKey);
}

export function decideAdminProviderVerification(
  adminKey: string,
  providerId: string,
  status: "verified" | "rejected"
) {
  return adminKycFetch<{ providerId: string; status: "verified" | "rejected"; message: string }>(
    `/admin/provider-verifications/${providerId}/decision`,
    adminKey,
    { method: "POST", body: { status } }
  );
}

export function createServiceRequest(payload: {
  serviceId: string;
  description?: string;
  providerId: string;
  serviceSubtype: string;
}) {
  return apiFetch<{ requestId: string }>("/requests", { method: "POST", auth: true, body: payload });
}

export function getClientOpenJobs() {
  return apiFetch<{ items: ClientOpenJobListItem[] }>("/client/open-jobs", { auth: true });
}

export function createClientOpenJob(payload: {
  serviceId: string;
  description?: string;
  serviceSubtype: string;
  location?: { lat: number; lng: number };
}) {
  return apiFetch<{ openJobId: string }>("/open-jobs", { method: "POST", auth: true, body: payload });
}

export function getOpenJobForClient(id: string) {
  return apiFetch<OpenJobDetailClient>(`/open-jobs/${id}`, { auth: true });
}

export function getOpenJobForProvider(id: string) {
  return apiFetch<OpenJobDetailProvider>(`/open-jobs/${id}`, { auth: true });
}

export function cancelClientOpenJob(id: string) {
  return apiFetch<{ ok: true }>(`/open-jobs/${id}/cancel`, { method: "POST", auth: true });
}

export function acceptOpenJobQuote(openJobId: string, quoteId: string) {
  return apiFetch<{ requestId: string }>(`/open-jobs/${openJobId}/quotes/${quoteId}/accept`, { method: "POST", auth: true });
}

export function getProviderOpenJobsDiscover() {
  return apiFetch<{ items: ProviderOpenJobDiscoverItem[] }>("/provider/open-jobs", { auth: true });
}

export function submitOpenJobQuote(
  openJobId: string,
  payload: { amount: number; etaDays?: number | null; message?: string | null; conditions?: string | null }
) {
  return apiFetch<{ quoteId: string }>(`/open-jobs/${openJobId}/quotes`, { method: "POST", auth: true, body: payload });
}

export function getProviders(
  serviceId: string,
  options?: { sort?: ProviderSearchSort; verifiedOnly?: boolean; minRating?: number }
) {
  const params = new URLSearchParams({ serviceId });
  params.set("sort", options?.sort ?? "recommended");
  if (options?.verifiedOnly) params.set("verifiedOnly", "true");
  if (options?.minRating != null && options.minRating > 0) {
    params.set("minRating", String(options.minRating));
  }
  return apiFetch<ProviderCard[]>(`/providers?${params.toString()}`, { auth: true });
}

export function getRequest(id: string) {
  return apiFetch<RequestDetails>(`/requests/${id}`, { auth: true });
}

export function getMessages(id: string) {
  return apiFetch<ChatMessage[]>(`/requests/${id}/messages`, { auth: true });
}

export function sendMessage(id: string, text: string) {
  return apiFetch<ChatMessage>(`/requests/${id}/messages`, {
    method: "POST",
    auth: true,
    body: { text },
  });
}

export function acceptRequest(id: string) {
  return apiFetch<{ ok: true }>(`/requests/${id}/accept`, { method: "POST", auth: true });
}

export function rejectRequest(id: string) {
  return apiFetch<{ ok: true }>(`/requests/${id}/reject`, { method: "POST", auth: true });
}

export function confirmRequest(id: string, agreedValue?: string) {
  return apiFetch<{ request: RequestDetails; message: ChatMessage }>(`/requests/${id}/confirm`, {
    method: "POST",
    auth: true,
    body: { agreedValue },
  });
}

export function cancelRequest(id: string, reason?: string) {
  return apiFetch<{ request: RequestDetails; message: ChatMessage }>(`/requests/${id}/cancel`, {
    method: "POST",
    auth: true,
    body: reason ? { reason } : {},
  });
}

export function completeRequest(id: string) {
  return apiFetch<{ request: RequestDetails; message: ChatMessage }>(`/requests/${id}/complete`, {
    method: "POST",
    auth: true,
  });
}

export function reportIncident(
  id: string,
  payload: { type: "fraude" | "conduta" | "cobranca" | "seguranca" | "outro"; description: string; attachments?: string[] }
) {
  return apiFetch<{ ok: true; message: string }>(`/requests/${id}/incidents`, {
    method: "POST",
    auth: true,
    body: payload,
  });
}

export function respondToRating(ratingId: string, response: string) {
  return apiFetch<{ ok: true }>(`/provider/ratings/${ratingId}/response`, {
    method: "POST",
    auth: true,
    body: { response },
  });
}
