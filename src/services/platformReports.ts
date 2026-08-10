import { getAuthToken } from "../lib/auth";

const BASE = "/api/platform/reports";

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

/* ─── types ──────────────────────────────────────────────── */

export interface AnalyticsSummary {
  totalOrgs: number; activeOrgs: number;
  totalUsers: number; activeUsers: number;
  totalSubs: number; activeSubs: number;
  mrr: number;
}
export interface AuditEntry {
  id: string; action: string; resource: string;
  actorEmail: string; details: string | null; createdAt: string;
}
export interface TopOrg {
  id: string; plan: string; amount: number;
  organization: { id: string; name: string; country: string };
}
export interface CountryCount { country: string; count: number }

export interface SummaryResponse {
  success: boolean;
  summary: AnalyticsSummary;
  recentAudit: AuditEntry[];
  topOrgs: TopOrg[];
  countryBreakdown: CountryCount[];
}

export interface GrowthPoint {
  month: string; orgs: number; subs: number; users: number;
}
export interface GrowthResponse {
  success: boolean;
  growth: GrowthPoint[];
  statusBreakdown: {
    active: number; trial: number; expired: number;
    suspended: number; cancelled: number;
  };
  planBreakdown: { starter: number; professional: number; enterprise: number };
}

/* ─── API calls ──────────────────────────────────────────── */

export const getAnalyticsSummary = () => request<SummaryResponse>(`${BASE}/summary`);
export const getGrowthData       = () => request<GrowthResponse>(`${BASE}/growth`);