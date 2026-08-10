import { authenticatedFetch, getAuthToken } from "../lib/auth";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const response = await authenticatedFetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "Request failed");
  return data as T;
}

/* ─── types ─────────────────────────────────────────────── */

export interface Subscription {
  id:             string;
  organizationId: string;
  plan:           string;
  status:         string;
  billingCycle:   string;
  amount:         number;
  currency:       string;
  startDate:      string;
  endDate:        string | null;
  trialEndsAt:    string | null;
  cancelledAt:    string | null;
  notes:          string | null;
  createdAt:      string;
  updatedAt:      string;
  organization: {
    id:      string;
    name:    string;
    slug:    string;
    email:   string | null;
    country: string;
    status:  string;
    logoUrl: string | null;
  };
}

export interface PlanBreakdownItem {
  plan:  string;
  count: number;
}

export interface SubscriptionsResponse {
  success:       boolean;
  subscriptions: Subscription[];
  pagination:    { total: number; page: number; limit: number; pages: number };
  stats:         { active: number; trial: number; expired: number; monthlyRevenue: number };
  planBreakdown: PlanBreakdownItem[];
}

export interface CreateSubscriptionPayload {
  organizationId: string;
  plan:           string;
  status:         string;
  billingCycle:   string;
  amount:         number;
  currency?:      string;
  startDate?:     string;
  endDate?:       string;
  trialEndsAt?:   string;
  notes?:         string;
}

export interface UpdateSubscriptionPayload {
  plan?:         string;
  status?:       string;
  billingCycle?: string;
  amount?:       number;
  currency?:     string;
  endDate?:      string | null;
  trialEndsAt?:  string | null;
  notes?:        string | null;
}

/* ─── api functions ─────────────────────────────────────── */

export function getSubscriptions(params?: {
  q?: string; status?: string; plan?: string; page?: number; limit?: number;
}): Promise<SubscriptionsResponse> {
  const qs = new URLSearchParams();
  if (params?.q)      qs.set("q",      params.q);
  if (params?.status) qs.set("status", params.status);
  if (params?.plan)   qs.set("plan",   params.plan);
  if (params?.page)   qs.set("page",   String(params.page));
  if (params?.limit)  qs.set("limit",  String(params.limit));
  const query = qs.toString();
  return request<SubscriptionsResponse>(
    `/api/platform/subscriptions${query ? `?${query}` : ""}`
  );
}

export function getSubscription(
  id: string
): Promise<{ success: boolean; subscription: Subscription }> {
  return request(`/api/platform/subscriptions/${id}`);
}

export function createSubscription(
  payload: CreateSubscriptionPayload
): Promise<{ success: boolean; subscription: Subscription }> {
  return request("/api/platform/subscriptions", {
    method: "POST",
    body:   JSON.stringify(payload),
  });
}

export function updateSubscription(
  id: string,
  payload: UpdateSubscriptionPayload
): Promise<{ success: boolean; subscription: Subscription }> {
  return request(`/api/platform/subscriptions/${id}`, {
    method: "PATCH",
    body:   JSON.stringify(payload),
  });
}