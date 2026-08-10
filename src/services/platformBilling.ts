import { getAuthToken } from "../lib/auth";

const BASE = "/api/platform/billing";

async function request<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Request failed");
  return data as T;
}

export interface BillingStats {
  mrr: number;
  arr: number;
  counts: { active: number; trial: number; suspended: number; expired: number; cancelled: number; total: number };
  planBreakdown: { starter: number; professional: number; enterprise: number };
}
export interface ExpiringSub {
  id: string; plan: string; status: string; amount: number; endDate: string;
  organization: { id: string; name: string; country: string };
}
export interface RecentSub {
  id: string; plan: string; status: string; billingCycle: string; amount: number; createdAt: string;
  organization: { id: string; name: string; country: string };
}
export interface BillingStatsResponse {
  success: boolean;
  stats: BillingStats;
  expiringSoon: ExpiringSub[];
  recentSubscriptions: RecentSub[];
}
export interface RevenuePoint { month: string; revenue: number }
export interface RevenueResponse {
  success: boolean;
  revenue: RevenuePoint[];
  planRevenue: { STARTER: number; PROFESSIONAL: number; ENTERPRISE: number };
}

export const getBillingStats    = () => request<BillingStatsResponse>(`${BASE}/stats`);
export const getRevenueBreakdown = () => request<RevenueResponse>(`${BASE}/revenue`);