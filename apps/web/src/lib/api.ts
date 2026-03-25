import { queryClient } from "./queryClient";

export type Role = "client" | "provider";

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
  address?: string;
  cpf?: string;
  radiusKm?: number;
  services?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RequestSummary {
  id: string;
  client: string;
  service: string;
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
  desc: string;
  date: string;
  value: string;
}

export type ProviderPaymentMethod = "pix" | "cartao_credito" | "cartao_debito";

export interface ProviderBillingSummary {
  monthlyFee: number;
  monthlyFeeLabel: string;
  freeTrialMonths: number;
  freeEndsAt: string;
  inFreePeriod: boolean;
  freeEndsAtLabel: string;
  unpaidMonths: { referenceMonth: string; label: string }[];
  hasOutstanding: boolean;
}

export type ProviderPaymentStatus = "pending" | "paid" | "cancelled";

export interface ProviderPaymentRow {
  id: string;
  amount: number;
  amountLabel: string;
  paymentMethod: ProviderPaymentMethod;
  status: ProviderPaymentStatus;
  referenceMonth: string;
  referenceMonthLabel: string;
  paidAt: string;
  paidAtLabel: string;
  pixCopyPaste: string | null;
  cardLastFour: string | null;
  createdAt: string;
}

export interface ProviderPaymentCreated {
  id: string;
  amount: number;
  amountLabel: string;
  paymentMethod: ProviderPaymentMethod;
  status: "paid";
  referenceMonth: string;
  referenceMonthLabel: string;
  paidAt: string;
  paidAtLabel: string;
  pixCopyPaste: string | null;
  cardLastFour: string | null;
}

export interface ClientHistoryItem {
  id: string;
  provider: string;
  service: string;
  desc: string;
  date: string;
  value: string;
  rated: boolean;
  rating: number;
  review: string;
}

export interface ClientRequestItem {
  id: string;
  provider: string;
  service: string;
  desc: string;
  status: string;
  statusLabel: string;
  chatOpen: boolean;
  time: string;
}

export interface RequestDetails {
  id: string;
  status: string;
  serviceId: string;
  serviceLabel: string;
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

export function registerClient(payload: {
  name: string;
  email: string;
  phone: string;
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

export function registerProvider(payload: {
  name: string;
  email: string;
  phone: string;
  cpf?: string;
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
}) {
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

export function getClientHistory() {
  return apiFetch<ClientHistoryItem[]>("/client/history", { auth: true });
}

export function getClientRequests() {
  return apiFetch<ClientRequestItem[]>("/client/requests", { auth: true });
}

export function createRating(payload: { requestId: string; rating: number; review?: string }) {
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

export function getProviderBillingSummary() {
  return apiFetch<ProviderBillingSummary>("/provider/billing/summary", { auth: true });
}

export function getProviderBillingPayments() {
  return apiFetch<ProviderPaymentRow[]>("/provider/billing/payments", { auth: true });
}

export function createProviderBillingPayment(payload: {
  paymentMethod: ProviderPaymentMethod;
  cardLastFour?: string;
}) {
  return apiFetch<ProviderPaymentCreated>("/provider/billing/payments", {
    method: "POST",
    auth: true,
    body: payload,
  });
}

export function createServiceRequest(payload: { serviceId: string; description?: string; providerId: string }) {
  return apiFetch<{ requestId: string }>("/requests", { method: "POST", auth: true, body: payload });
}

export function getProviders(serviceId: string) {
  return apiFetch<ProviderCard[]>(`/providers?serviceId=${serviceId}`, { auth: true });
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
